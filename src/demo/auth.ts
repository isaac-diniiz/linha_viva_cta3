import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/** Onde ficam as contas de professor (Supabase em produção). */
export type TeacherDirectory = {
  /** Cria a conta; lança AccountExistsError se o e-mail já existe. */
  create(email: string, password: string): Promise<void>;
  verify(email: string, password: string): Promise<boolean>;
};

export class AccountExistsError extends Error {
  constructor() {
    super("Este e-mail já tem conta. Use Entrar.");
  }
}

export type TeacherSession = { email: string };

const COOKIE = "lv_professor";
/** Um turno escolar. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MIN_PASSWORD = 8;
const MAX_BODY = 4096;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Sessão assinada: `<dados em base64url>.<HMAC-SHA256>`. */
export function signSession(
  { email }: TeacherSession,
  secret: string,
  now: number,
  ttlMs = SESSION_TTL_MS,
): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: now + ttlMs }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readSession(
  token: string,
  secret: string,
  now: number,
): TeacherSession | null {
  const [payload, signed, ...rest] = token.split(".");
  if (!payload || !signed || rest.length) return null;
  if (!sameText(signed, signature(payload, secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.email !== "string" || typeof data.exp !== "number")
      return null;
    return data.exp > now ? { email: data.email } : null;
  } catch {
    return null;
  }
}

function cookieValue(header: string | undefined, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

/** Professor da sessão, a partir do cabeçalho Cookie de uma requisição. */
export function teacherFromCookie(
  header: string | undefined,
  secret: string,
  now: number,
): TeacherSession | null {
  const token = cookieValue(header, COOKIE);
  return token ? readSession(token, secret, now) : null;
}

/** Sem código configurado, o cadastro fica fechado. */
export function inviteMatches(
  given: string,
  expected: string | undefined,
): boolean {
  if (!expected) return false;
  return sameText(given.trim(), expected);
}

/** Conta falhas por chave numa janela de tempo. */
export function createRateLimiter(max: number, windowMs: number) {
  const failures = new Map<string, { count: number; since: number }>();
  const current = (key: string, now: number) => {
    const entry = failures.get(key);
    if (entry && now - entry.since > windowMs) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    blocked: (key: string, now: number) =>
      (current(key, now)?.count ?? 0) >= max,
    fail: (key: string, now: number) => {
      const entry = current(key, now);
      failures.set(key, {
        count: (entry?.count ?? 0) + 1,
        since: entry?.since ?? now,
      });
    },
    reset: (key: string) => failures.delete(key),
  };
}

function clientAddress(request: IncomingMessage): string {
  // atrás do proxy do Render, o endereço do aluno vem neste cabeçalho
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  return first || request.socket.remoteAddress || "desconhecido";
}

function isHttps(request: IncomingMessage): boolean {
  return (
    request.headers["x-forwarded-proto"] === "https" ||
    Boolean((request.socket as { encrypted?: boolean }).encrypted)
  );
}

function sessionCookie(request: IncomingMessage, token: string, ttlMs: number) {
  return [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
    ...(isHttps(request) ? ["Secure"] : []),
  ].join("; ");
}

function reply(
  response: ServerResponse,
  status: number,
  body?: unknown,
  cookie?: string,
) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(cookie ? { "set-cookie": cookie } : {}),
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readJson(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("grande demais");
    chunks.push(chunk as Buffer);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (typeof data !== "object" || data === null || Array.isArray(data))
    throw new Error("formato");
  return data;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Endereços de conta do professor sob /demo/api: cadastro (com convite),
 * entrar, sair e eu. Devolve false para qualquer outro endereço.
 */
export function createAuthHandler({
  directory,
  secret,
  invite,
  now = Date.now,
  ttlMs = SESSION_TTL_MS,
}: {
  directory: TeacherDirectory;
  secret: string;
  invite: string | undefined;
  now?: () => number;
  ttlMs?: number;
}) {
  const byAddress = createRateLimiter(5, 15 * 60 * 1000);
  const byEmail = createRateLimiter(5, 15 * 60 * 1000);
  const loggedIn = (request: IncomingMessage, email: string) =>
    sessionCookie(request, signSession({ email }, secret, now(), ttlMs), ttlMs);

  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (!path.startsWith("/demo/api/")) return false;

    if (path === "/demo/api/eu" && request.method === "GET") {
      const teacher = teacherFromCookie(request.headers.cookie, secret, now());
      if (teacher) reply(response, 200, teacher);
      else reply(response, 401, { erro: "Entre como professor." });
      return true;
    }
    if (path === "/demo/api/sair" && request.method === "POST") {
      reply(
        response,
        204,
        undefined,
        `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      );
      return true;
    }
    const isSignup = path === "/demo/api/cadastro";
    if (
      (!isSignup && path !== "/demo/api/entrar") ||
      request.method !== "POST"
    ) {
      reply(response, 404, { erro: "Endereço desconhecido." });
      return true;
    }
    // só JSON: formulários de outros sites não conseguem enviar este tipo
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      reply(response, 415, { erro: "Envie os dados em JSON." });
      return true;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJson(request);
    } catch {
      reply(response, 400, { erro: "Dados inválidos." });
      return true;
    }
    const email = text(body.email).trim().toLowerCase();
    const password = text(body.senha);

    if (isSignup) {
      if (!inviteMatches(text(body.convite), invite)) {
        reply(response, 403, { erro: "Código de convite incorreto." });
        return true;
      }
      if (!EMAIL.test(email)) {
        reply(response, 400, { erro: "Informe um e-mail válido." });
        return true;
      }
      if (password.length < MIN_PASSWORD) {
        reply(response, 400, {
          erro: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
        });
        return true;
      }
      try {
        await directory.create(email, password);
      } catch (error) {
        if (error instanceof AccountExistsError)
          reply(response, 409, { erro: error.message });
        else
          reply(response, 502, {
            erro: "Não foi possível criar a conta agora.",
          });
        return true;
      }
      reply(response, 201, { email }, loggedIn(request, email));
      return true;
    }

    const address = clientAddress(request);
    const at = now();
    if (byAddress.blocked(address, at) || byEmail.blocked(email, at)) {
      reply(response, 429, {
        erro: "Muitas tentativas. Espere 15 minutos e tente de novo.",
      });
      return true;
    }
    let valid = false;
    try {
      valid = EMAIL.test(email) && (await directory.verify(email, password));
    } catch {
      reply(response, 502, { erro: "Não foi possível entrar agora." });
      return true;
    }
    if (!valid) {
      byAddress.fail(address, at);
      byEmail.fail(email, at);
      reply(response, 401, { erro: "E-mail ou senha incorretos." });
      return true;
    }
    byAddress.reset(address);
    byEmail.reset(email);
    reply(response, 200, { email }, loggedIn(request, email));
    return true;
  };
}
