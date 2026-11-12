// @vitest-environment node
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { signSession } from "./auth";
import type { LineStore } from "./lineStore";
import { attachDemoServer } from "./server";

type Snapshot = {
  themeId: string;
  title: string;
  status: string;
  linesStorage?: string;
  themes?: { id: string; title: string; cardCount: number }[];
  customLines?: { id: string; titulo: string; cartoes: string[] }[];
};
type Message = { type: string; message?: string; state?: Snapshot };
type Op = { op: string; id?: string; owner?: string | null };

const line = (overrides: Record<string, unknown> = {}) => ({
  titulo: "Fases da escola",
  inicio: "Mais antigo",
  fim: "Mais recente",
  cartoes: ["Fundação", "Reforma", "Biblioteca"],
  embaralhar: false,
  ...overrides,
});

const stored = (id: string, titulo: string) => ({
  id,
  disciplina: "Minhas linhas",
  serie: "Livre",
  titulo,
  instrucao: "Ordene.",
  eixo: { inicio: "a", fim: "b" },
  embaralhar: false,
  reservarCartaoDoProfessor: false,
  cartoes: [1, 2, 3].map((n) => ({ id: `c${n}`, texto: `x${n}`, ordem: n })),
});

/** Armazenamento de mentira: guarda na memória e deixa falhar ou demorar. */
function memoryStore(
  options: {
    source?: LineStore["source"];
    initial?: unknown[];
    delayMs?: number;
    failing?: Partial<
      Record<"load" | "create" | "replace" | "remove", boolean>
    >;
    persisted?: boolean;
  } = {},
) {
  const rows = new Map<string, unknown>();
  const ops: Op[] = [];
  const pause = () =>
    new Promise((done) => setTimeout(done, options.delayMs ?? 0));
  const store: LineStore = {
    source: options.source ?? "supabase",
    async load() {
      ops.push({ op: "load" });
      if (options.failing?.load) throw new Error("Supabase fora do ar.");
      return options.initial ?? [];
    },
    async create(id, raw, owner) {
      ops.push({ op: "create", id, owner });
      await pause();
      if (options.failing?.create)
        throw new Error("Não foi possível salvar a linha no Supabase (500).");
      rows.set(id, raw);
      return options.persisted ?? true;
    },
    async replace(id, raw, owner) {
      ops.push({ op: "replace", id, owner });
      await pause();
      if (options.failing?.replace)
        throw new Error("Não foi possível salvar a linha no Supabase (500).");
      rows.set(id, raw);
      return true;
    },
    async remove(id) {
      ops.push({ op: "remove", id });
      await pause();
      if (options.failing?.remove)
        throw new Error("Não foi possível apagar a linha no Supabase (500).");
      rows.delete(id);
    },
  };
  return { store, rows, ops };
}

describe("linhas criadas guardadas pelo servidor num armazenamento", () => {
  let server: Server | null = null;
  let dir = "";
  const sockets: WebSocket[] = [];
  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    await new Promise((done) => server?.close(done) ?? done(null));
    server = null;
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  async function start(
    store: LineStore,
    extra: Parameters<typeof attachDemoServer>[1] = {},
  ) {
    dir = mkdtempSync(join(tmpdir(), "linha-viva-lines-"));
    cpSync(resolve("atividades"), dir, { recursive: true });
    server = createServer();
    const { code, ready } = attachDemoServer(server, {
      activitiesDir: dir,
      theme: "ciclo-da-agua",
      lines: store,
      ...extra,
    });
    await ready;
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    return { code, port: (server.address() as AddressInfo).port };
  }

  async function connect(
    port: number,
    join: Record<string, unknown>,
    cookie?: string,
  ) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/demo-ws`, {
      headers: cookie ? { cookie } : {},
    });
    sockets.push(socket);
    const received: Message[] = [];
    socket.on("message", (data) => received.push(JSON.parse(String(data))));
    await new Promise((done) => socket.once("open", done));
    socket.send(JSON.stringify({ type: "join", ...join }));
    await expect.poll(() => received.length).toBeGreaterThan(0);
    return { socket, received };
  }

  const latest = (received: Message[]) =>
    [...received].reverse().find((message) => message.type === "snapshot")
      ?.state;
  const lastError = (received: Message[]) =>
    [...received].reverse().find((message) => message.type === "error")
      ?.message;
  const send = (teacher: { socket: WebSocket }, message: unknown) =>
    teacher.socket.send(JSON.stringify(message));
  const files = () =>
    readdirSync(dir).filter((file) => file.startsWith("criada-"));

  it("junta ao menu as linhas guardadas, já prontas para o professor editar", async () => {
    const { store } = memoryStore({
      initial: [
        stored("criada-fases", "Fases"),
        stored("criada-uniao", "União"),
      ],
    });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    const snapshot = latest(teacher.received)!;
    expect(snapshot.themes?.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["ciclo-da-agua", "criada-fases", "criada-uniao"]),
    );
    expect(snapshot.customLines?.map((entry) => entry.titulo)).toEqual([
      "Fases",
      "União",
    ]);
  });

  it("conta ao professor, e só a ele, onde as linhas ficam guardadas", async () => {
    const { store } = memoryStore();
    const { port, code } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    expect(latest(teacher.received)?.linesStorage).toBe("supabase");
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-armazenamento-1",
    });
    await expect.poll(() => latest(student.received)).toBeDefined();
    expect(latest(student.received)?.linesStorage).toBeUndefined();
  });

  it("quem já estava conectado recebe as linhas assim que elas chegam", async () => {
    dir = mkdtempSync(join(tmpdir(), "linha-viva-lines-"));
    const { store } = memoryStore({
      initial: [stored("criada-fases", "Fases")],
      delayMs: 0,
    });
    const slowLoad: LineStore = {
      ...store,
      load: async () => {
        await new Promise((done) => setTimeout(done, 150));
        return store.load();
      },
    };
    cpSync(resolve("atividades"), dir, { recursive: true });
    server = createServer();
    const { ready } = attachDemoServer(server, {
      activitiesDir: dir,
      theme: "ciclo-da-agua",
      lines: slowLoad,
    });
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    const port = (server.address() as AddressInfo).port;
    const teacher = await connect(port, { role: "teacher" });
    expect(latest(teacher.received)?.customLines).toEqual([]);
    await ready;
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(1);
  });

  it("ignora linha guardada inválida, repetida ou que não seja criada-*, e segue funcionando", async () => {
    const { store } = memoryStore({
      initial: [
        stored("criada-boa", "Boa"),
        { id: "criada-quebrada", titulo: "" },
        stored("ciclo-da-agua", "Tentativa de trocar uma atividade pronta"),
        stored("criada-boa", "Boa de novo"),
        "lixo",
      ],
    });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    const snapshot = latest(teacher.received)!;
    expect(snapshot.customLines?.map((entry) => entry.id)).toEqual([
      "criada-boa",
    ]);
    expect(
      snapshot.themes?.find((theme) => theme.id === "ciclo-da-agua")?.title,
    ).toBe("Ciclo da água");
  });

  it("se o armazenamento não responde na partida, o servidor sobe com as atividades prontas", async () => {
    const { store } = memoryStore({ failing: { load: true } });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    expect(latest(teacher.received)?.customLines).toEqual([]);
    expect(latest(teacher.received)?.themes?.length).toBeGreaterThan(1);
  });

  it("com o Supabase como armazenamento, arquivos criada-* velhos da pasta não viram linhas", async () => {
    dir = mkdtempSync(join(tmpdir(), "linha-viva-lines-"));
    cpSync(resolve("atividades"), dir, { recursive: true });
    writeFileSync(
      join(dir, "criada-velha.json"),
      JSON.stringify(stored("criada-velha", "Velha")),
    );
    const { store } = memoryStore();
    server = createServer();
    const { ready } = attachDemoServer(server, {
      activitiesDir: dir,
      theme: "ciclo-da-agua",
      lines: store,
    });
    await ready;
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    const teacher = await connect((server.address() as AddressInfo).port, {
      role: "teacher",
    });
    expect(latest(teacher.received)?.customLines).toEqual([]);
  });

  it("cria a linha no armazenamento, com o e-mail do professor, e não grava arquivo", async () => {
    const secret = "s".repeat(40);
    const cookie = `lv_professor=${signSession({ email: "ana@escola.br" }, secret, Date.now())}`;
    const { store, rows, ops } = memoryStore();
    const { port } = await start(store, {
      publicMode: true,
      sessionSecret: secret,
    });
    const teacher = await connect(port, { role: "teacher" }, cookie);
    send(teacher, { type: "createTheme", line: line() });
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("criada-fases-da-escola");
    expect(ops.filter((entry) => entry.op !== "load")).toEqual([
      { op: "create", id: "criada-fases-da-escola", owner: "ana@escola.br" },
    ]);
    expect(rows.has("criada-fases-da-escola")).toBe(true);
    expect(files()).toEqual([]);
    expect(latest(teacher.received)?.customLines).toHaveLength(1);
  });

  it("sem login (uso local), a linha é criada sem dono identificado", async () => {
    const { store, ops } = memoryStore();
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "createTheme", line: line() });
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(1);
    expect(ops.find((entry) => entry.op === "create")?.owner).toBe(null);
  });

  it("se o armazenamento recusa, mostra o motivo e não cria a linha nem troca o tema", async () => {
    const { store, rows } = memoryStore({ failing: { create: true } });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "createTheme", line: line() });
    await expect
      .poll(() => lastError(teacher.received))
      .toMatch(/Não foi possível salvar a linha/);
    expect(latest(teacher.received)?.themeId).toBe("ciclo-da-agua");
    expect(latest(teacher.received)?.customLines).toEqual([]);
    expect(rows.size).toBe(0);
  });

  it("linha que só vale até reiniciar (disco sem gravação) ainda é criada", async () => {
    const { store } = memoryStore({ persisted: false });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "createTheme", line: line() });
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("criada-fases-da-escola");
  });

  it("não chama o armazenamento quando o formulário é inválido", async () => {
    const { store, ops } = memoryStore();
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "createTheme", line: line({ titulo: "" }) });
    await expect
      .poll(() => lastError(teacher.received))
      .toMatch(/Dê um nome ao tema da linha/);
    expect(ops.filter((entry) => entry.op !== "load")).toEqual([]);
  });

  it("duas criações seguidas, com armazenamento lento, ganham ids diferentes", async () => {
    const { store, rows } = memoryStore({ delayMs: 60 });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "createTheme", line: line() });
    send(teacher, { type: "createTheme", line: line() });
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(2);
    expect([...rows.keys()].sort()).toEqual([
      "criada-fases-da-escola",
      "criada-fases-da-escola-2",
    ]);
  });

  it("não deixa iniciar a atividade enquanto a linha ainda está sendo salva", async () => {
    const { store } = memoryStore({ delayMs: 120 });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "createTheme", line: line() });
    send(teacher, { type: "status", status: "active" });
    await expect.poll(() => lastError(teacher.received)).toMatch(/Aguarde/);
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(1);
    expect(latest(teacher.received)?.status).toBe("waiting");
    send(teacher, { type: "status", status: "active" });
    await expect.poll(() => latest(teacher.received)?.status).toBe("active");
  });

  it("edita a linha no armazenamento e só então troca o que a turma vê", async () => {
    const { store, rows, ops } = memoryStore({
      initial: [stored("criada-fases", "Antes")],
    });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "theme", themeId: "criada-fases" });
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("criada-fases");
    send(teacher, {
      type: "updateTheme",
      id: "criada-fases",
      line: line({ titulo: "Depois", cartoes: ["A", "B", "C", "D"] }),
    });
    await expect.poll(() => latest(teacher.received)?.title).toBe("Depois");
    expect(ops.filter((entry) => entry.op === "replace")).toEqual([
      { op: "replace", id: "criada-fases", owner: null },
    ]);
    expect((rows.get("criada-fases") as { titulo: string }).titulo).toBe(
      "Depois",
    );
    expect(
      latest(teacher.received)?.themes?.find(
        (theme) => theme.id === "criada-fases",
      )?.cardCount,
    ).toBe(4);
  });

  it("se o armazenamento recusa a edição, a linha continua como estava", async () => {
    const { store, rows } = memoryStore({
      initial: [stored("criada-fases", "Antes")],
      failing: { replace: true },
    });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, {
      type: "updateTheme",
      id: "criada-fases",
      line: line({ titulo: "Depois" }),
    });
    await expect
      .poll(() => lastError(teacher.received))
      .toMatch(/Não foi possível salvar a linha/);
    expect(latest(teacher.received)?.customLines?.[0].titulo).toBe("Antes");
    expect(rows.size).toBe(0);
  });

  it("apaga a linha do armazenamento e do menu", async () => {
    const { store, rows, ops } = memoryStore({
      initial: [stored("criada-fases", "Fases")],
    });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "deleteTheme", id: "criada-fases" });
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(0);
    expect(ops.filter((entry) => entry.op === "remove")).toEqual([
      { op: "remove", id: "criada-fases" },
    ]);
    expect(rows.size).toBe(0);
    expect(
      latest(teacher.received)?.themes?.some(
        (theme) => theme.id === "criada-fases",
      ),
    ).toBe(false);
  });

  it("se o armazenamento recusa apagar, a linha continua no menu", async () => {
    const { store } = memoryStore({
      initial: [stored("criada-fases", "Fases")],
      failing: { remove: true },
    });
    const { port } = await start(store);
    const teacher = await connect(port, { role: "teacher" });
    send(teacher, { type: "deleteTheme", id: "criada-fases" });
    await expect
      .poll(() => lastError(teacher.received))
      .toMatch(/Não foi possível apagar a linha/);
    expect(latest(teacher.received)?.customLines).toHaveLength(1);
  });

  it("sem armazenamento escolhido, continua gravando arquivos como antes", async () => {
    dir = mkdtempSync(join(tmpdir(), "linha-viva-lines-"));
    cpSync(resolve("atividades"), dir, { recursive: true });
    server = createServer();
    const { ready } = attachDemoServer(server, {
      activitiesDir: dir,
      theme: "ciclo-da-agua",
    });
    await ready;
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    const teacher = await connect((server.address() as AddressInfo).port, {
      role: "teacher",
    });
    send(teacher, { type: "createTheme", line: line() });
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(1);
    expect(existsSync(join(dir, "criada-fases-da-escola.json"))).toBe(true);
  });
});
