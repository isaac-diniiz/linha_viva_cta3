// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccountExistsError,
  createAuthHandler,
  createRateLimiter,
  inviteMatches,
  readSession,
  signSession,
  teacherFromCookie,
  type TeacherDirectory,
} from "./auth";

const SECRET = "segredo-de-teste-com-tamanho-suficiente";
const HOUR = 60 * 60 * 1000;

/** Diretório em memória, no lugar do Supabase. */
function fakeDirectory(): TeacherDirectory & { accounts: Map<string, string> } {
  const accounts = new Map<string, string>();
  return {
    accounts,
    async create(email, password) {
      if (accounts.has(email)) throw new AccountExistsError();
      accounts.set(email, password);
    },
    async verify(email, password) {
      return accounts.get(email) === password;
    },
  };
}

describe("sessão do professor", () => {
  it("lê de volta a sessão assinada enquanto ela vale", () => {
    const token = signSession({ email: "ana@escola.br" }, SECRET, 0, HOUR);
    expect(readSession(token, SECRET, HOUR - 1)).toEqual({
      email: "ana@escola.br",
    });
  });

  it("recusa sessão vencida, adulterada ou assinada com outro segredo", () => {
    const token = signSession({ email: "ana@escola.br" }, SECRET, 0, HOUR);
    expect(readSession(token, SECRET, HOUR + 1)).toBeNull();
    expect(
      readSession(token, "outro-segredo-qualquer-bem-longo", 0),
    ).toBeNull();
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ email: "intruso@x.br", exp: HOUR }),
    ).toString("base64url");
    expect(readSession(`${forged}.${signature}`, SECRET, 0)).toBeNull();
    expect(readSession(`${payload}.`, SECRET, 0)).toBeNull();
    expect(readSession("lixo", SECRET, 0)).toBeNull();
  });

  it("encontra a sessão no cabeçalho de cookies da conexão", () => {
    const token = signSession({ email: "ana@escola.br" }, SECRET, 0, HOUR);
    expect(
      teacherFromCookie(`outro=1; lv_professor=${token}`, SECRET, 1),
    ).toEqual({ email: "ana@escola.br" });
    expect(teacherFromCookie(undefined, SECRET, 1)).toBeNull();
  });
});

describe("código de convite", () => {
  it("aceita só o código configurado, ignorando espaços nas pontas", () => {
    expect(inviteMatches(" turma-viva ", "turma-viva")).toBe(true);
    expect(inviteMatches("turma-morta", "turma-viva")).toBe(false);
    expect(inviteMatches("", "turma-viva")).toBe(false);
  });

  it("sem código configurado, ninguém se cadastra", () => {
    expect(inviteMatches("", "")).toBe(false);
    expect(inviteMatches("qualquer", undefined)).toBe(false);
  });
});

describe("limite de tentativas", () => {
  it("bloqueia depois de 5 falhas na janela e libera quando ela passa", () => {
    const limiter = createRateLimiter(5, 15 * 60 * 1000);
    for (let i = 0; i < 5; i++) {
      expect(limiter.blocked("1.2.3.4", 0)).toBe(false);
      limiter.fail("1.2.3.4", 0);
    }
    expect(limiter.blocked("1.2.3.4", 1000)).toBe(true);
    expect(limiter.blocked("5.6.7.8", 1000)).toBe(false);
    expect(limiter.blocked("1.2.3.4", 15 * 60 * 1000 + 1)).toBe(false);
  });

  it("zera a contagem depois de um acerto", () => {
    const limiter = createRateLimiter(2, 1000);
    limiter.fail("ip", 0);
    limiter.reset("ip");
    limiter.fail("ip", 0);
    expect(limiter.blocked("ip", 0)).toBe(false);
  });
});

describe("endereços de cadastro e login", () => {
  let server: Server | null = null;
  afterEach(async () => {
    await new Promise((done) => server?.close(done) ?? done(null));
    server = null;
  });

  async function start(invite = "turma-viva") {
    const directory = fakeDirectory();
    const handle = createAuthHandler({
      directory,
      secret: SECRET,
      invite,
      now: () => 0,
    });
    server = createServer((request, response) => {
      void handle(request, response).then((handled) => {
        if (!handled) response.writeHead(404).end();
      });
    });
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (path: string, body: unknown, cookie = "") =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      });
    return { base, post, directory };
  }

  const cookieOf = (response: Response) =>
    (response.headers.get("set-cookie") ?? "").split(";")[0];

  it("cadastra com o convite certo e já entra, com cookie protegido", async () => {
    const { post, base, directory } = await start();
    const response = await post("/demo/api/cadastro", {
      email: "Ana@Escola.br ",
      senha: "senha-forte",
      convite: "turma-viva",
    });
    expect(response.status).toBe(201);
    expect(directory.accounts.get("ana@escola.br")).toBe("senha-forte");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^lv_professor=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const me = await fetch(`${base}/demo/api/eu`, {
      headers: { cookie: cookieOf(response) },
    });
    expect(await me.json()).toEqual({ email: "ana@escola.br" });
  });

  it("recusa cadastro sem o convite certo, com senha curta ou e-mail inválido", async () => {
    const { post, directory } = await start();
    const wrongInvite = await post("/demo/api/cadastro", {
      email: "ana@escola.br",
      senha: "senha-forte",
      convite: "chute",
    });
    expect(wrongInvite.status).toBe(403);
    expect((await wrongInvite.json()).erro).toMatch(/convite/i);
    const short = await post("/demo/api/cadastro", {
      email: "ana@escola.br",
      senha: "curta",
      convite: "turma-viva",
    });
    expect(short.status).toBe(400);
    expect((await short.json()).erro).toMatch(/8 caracteres/);
    const badEmail = await post("/demo/api/cadastro", {
      email: "ana",
      senha: "senha-forte",
      convite: "turma-viva",
    });
    expect(badEmail.status).toBe(400);
    expect(directory.accounts.size).toBe(0);
  });

  it("explica quando o e-mail já tem conta", async () => {
    const { post } = await start();
    const body = {
      email: "ana@escola.br",
      senha: "senha-forte",
      convite: "turma-viva",
    };
    await post("/demo/api/cadastro", body);
    const again = await post("/demo/api/cadastro", body);
    expect(again.status).toBe(409);
    expect((await again.json()).erro).toMatch(/já tem conta/);
  });

  it("entra com a senha certa e recusa a errada sem dizer qual campo errou", async () => {
    const { post, directory } = await start();
    directory.accounts.set("ana@escola.br", "senha-forte");
    const ok = await post("/demo/api/entrar", {
      email: "ana@escola.br",
      senha: "senha-forte",
    });
    expect(ok.status).toBe(200);
    expect(cookieOf(ok)).toMatch(/^lv_professor=.+/);
    const wrong = await post("/demo/api/entrar", {
      email: "ana@escola.br",
      senha: "errada-demais",
    });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).erro).toBe("E-mail ou senha incorretos.");
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  it("bloqueia o login depois de 5 senhas erradas", async () => {
    const { post, directory } = await start();
    directory.accounts.set("ana@escola.br", "senha-forte");
    for (let i = 0; i < 5; i++)
      await post("/demo/api/entrar", {
        email: "ana@escola.br",
        senha: "errada-demais",
      });
    const blocked = await post("/demo/api/entrar", {
      email: "ana@escola.br",
      senha: "senha-forte",
    });
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).erro).toMatch(/tentativas/);
  });

  it("sai apagando o cookie e responde que não há professor sem sessão", async () => {
    const { post, base } = await start();
    const out = await post("/demo/api/sair", {});
    expect(out.status).toBe(204);
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    const me = await fetch(`${base}/demo/api/eu`);
    expect(me.status).toBe(401);
  });

  it("aceita só JSON nos envios, contra formulários de outros sites", async () => {
    const { base } = await start();
    const form = await fetch(`${base}/demo/api/entrar`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=ana%40escola.br&senha=senha-forte",
    });
    expect(form.status).toBe(415);
  });

  it("não trata endereços fora da API", async () => {
    const { base } = await start();
    expect((await fetch(`${base}/demo/professor`)).status).toBe(404);
  });
});
