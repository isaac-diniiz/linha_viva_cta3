// @vitest-environment node
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { cpSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { attachDemoServer } from "./server";

type Snapshot = {
  themeId: string;
  title: string;
  axis: { start: string; end: string };
  themes?: { id: string; title: string; subject: string; cardCount: number }[];
  customLines?: ({ id: string } & Record<string, unknown>)[];
  items: { id: string; label: string }[];
  status: string;
};
type Message = { type: string; message?: string; state?: Snapshot };

const line = (overrides: Record<string, unknown> = {}) => ({
  titulo: "Fases da escola",
  inicio: "Mais antigo",
  fim: "Mais recente",
  cartoes: ["Fundação", "Reforma", "Biblioteca"],
  embaralhar: false,
  ...overrides,
});

describe("criar linha pelo painel do professor, no servidor", () => {
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

  async function start() {
    // pasta própria: criar uma linha grava um arquivo, e o repositório não pode sujar
    dir = mkdtempSync(join(tmpdir(), "linha-viva-criar-"));
    cpSync(resolve("atividades"), dir, { recursive: true });
    server = createServer();
    const { code } = attachDemoServer(server, {
      activitiesDir: dir,
      theme: "ciclo-da-agua",
    });
    await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
    return { code, port: (server.address() as AddressInfo).port };
  }

  async function connect(port: number, join: Record<string, unknown>) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/demo-ws`);
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
  const files = () =>
    readdirSync(dir).filter((file) => file.startsWith("criada-"));

  it("cria a linha, já a seleciona para a turma e a salva como arquivo de atividade", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-criar-1",
    });
    teacher.socket.send(JSON.stringify({ type: "createTheme", line: line() }));
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("criada-fases-da-escola");
    const snapshot = latest(teacher.received)!;
    expect(snapshot.title).toBe("Fases da escola");
    expect(snapshot.axis).toEqual({
      start: "Mais antigo",
      end: "Mais recente",
    });
    expect(
      snapshot.themes?.find((t) => t.id === "criada-fases-da-escola"),
    ).toMatchObject({ subject: "Minhas linhas", cardCount: 3 });
    // a turma já conectada recebe o novo tema, sem o menu do professor
    await expect
      .poll(() => latest(student.received)?.themeId)
      .toBe("criada-fases-da-escola");
    expect(latest(student.received)?.themes).toBeUndefined();
    expect(files()).toEqual(["criada-fases-da-escola.json"]);
  });

  it("recusa a criação feita por aluno e não altera o catálogo", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-criar-2",
    });
    student.socket.send(JSON.stringify({ type: "createTheme", line: line() }));
    await expect.poll(() => lastError(student.received)).toBeTruthy();
    expect(latest(teacher.received)?.themeId).toBe("ciclo-da-agua");
    expect(files()).toEqual([]);
  });

  it("não cria depois que a atividade começou", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    teacher.socket.send(JSON.stringify({ type: "status", status: "active" }));
    await expect.poll(() => latest(teacher.received)?.status).toBe("active");
    teacher.socket.send(JSON.stringify({ type: "createTheme", line: line() }));
    await expect
      .poll(() => lastError(teacher.received))
      .toMatch(/antes de iniciar/);
    expect(latest(teacher.received)?.themeId).toBe("ciclo-da-agua");
    expect(files()).toEqual([]);
  });

  it("explica em português o que está errado no formulário e não grava nada", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    teacher.socket.send(
      JSON.stringify({
        type: "createTheme",
        line: line({ titulo: "", cartoes: ["Só um", "Dois"] }),
      }),
    );
    await expect.poll(() => lastError(teacher.received)).toBeTruthy();
    const message = lastError(teacher.received)!;
    expect(message).toContain("Dê um nome ao tema da linha.");
    expect(message).toContain("Use de 3 a 40 cartões (há 2).");
    expect(files()).toEqual([]);
    expect(latest(teacher.received)?.themeId).toBe("ciclo-da-agua");
  });

  it("recusa um pedido sem formulário", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    teacher.socket.send(JSON.stringify({ type: "createTheme" }));
    await expect.poll(() => lastError(teacher.received)).toBeTruthy();
    expect(files()).toEqual([]);
  });

  it("dá um id diferente a duas linhas com o mesmo título", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    teacher.socket.send(JSON.stringify({ type: "createTheme", line: line() }));
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("criada-fases-da-escola");
    teacher.socket.send(JSON.stringify({ type: "createTheme", line: line() }));
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("criada-fases-da-escola-2");
    expect(files().sort()).toEqual([
      "criada-fases-da-escola-2.json",
      "criada-fases-da-escola.json",
    ]);
    expect(existsSync(join(dir, "ciclo-da-agua.json"))).toBe(true);
  });

  async function createLine(
    teacher: Awaited<ReturnType<typeof connect>>,
    overrides: Record<string, unknown> = {},
  ) {
    teacher.socket.send(
      JSON.stringify({ type: "createTheme", line: line(overrides) }),
    );
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length ?? 0)
      .toBeGreaterThan(0);
  }

  it("manda ao professor, e só a ele, as linhas criadas para editar", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-editar-0",
    });
    expect(latest(teacher.received)?.customLines).toEqual([]);
    await createLine(teacher);
    expect(latest(teacher.received)?.customLines).toEqual([
      expect.objectContaining({
        id: "criada-fases-da-escola",
        titulo: "Fases da escola",
        inicio: "Mais antigo",
        fim: "Mais recente",
        cartoes: ["Fundação", "Reforma", "Biblioteca"],
      }),
    ]);
    expect(latest(student.received)?.customLines).toBeUndefined();
  });

  it("edita a linha criada: mantém o id, regrava o arquivo e entrega os novos cartões à turma", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-editar-1",
    });
    await createLine(teacher);
    teacher.socket.send(
      JSON.stringify({
        type: "updateTheme",
        id: "criada-fases-da-escola",
        line: line({
          titulo: "Fases da escola (nova)",
          cartoes: ["Fundação", "Reforma", "Biblioteca", "Quadra"],
        }),
      }),
    );
    await expect
      .poll(() => latest(teacher.received)?.title)
      .toBe("Fases da escola (nova)");
    const snapshot = latest(teacher.received)!;
    expect(snapshot.themeId).toBe("criada-fases-da-escola");
    expect(
      snapshot.themes?.find((t) => t.id === "criada-fases-da-escola"),
    ).toMatchObject({ title: "Fases da escola (nova)", cardCount: 4 });
    expect(snapshot.customLines?.[0]?.cartoes).toHaveLength(4);
    await expect
      .poll(() => latest(student.received)?.title)
      .toBe("Fases da escola (nova)");
    expect(files()).toEqual(["criada-fases-da-escola.json"]);
    expect(
      JSON.parse(readFileSync(join(dir, "criada-fases-da-escola.json"), "utf8"))
        .titulo,
    ).toBe("Fases da escola (nova)");
  });

  it("edita uma linha que não está selecionada sem trocar o tema da turma", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    await createLine(teacher);
    teacher.socket.send(
      JSON.stringify({ type: "theme", themeId: "ciclo-da-agua" }),
    );
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("ciclo-da-agua");
    teacher.socket.send(
      JSON.stringify({
        type: "updateTheme",
        id: "criada-fases-da-escola",
        line: line({ titulo: "Renomeada" }),
      }),
    );
    await expect
      .poll(() => latest(teacher.received)?.customLines?.[0]?.titulo)
      .toBe("Renomeada");
    expect(latest(teacher.received)?.themeId).toBe("ciclo-da-agua");
  });

  it("recusa a edição inválida e não mexe no arquivo", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    await createLine(teacher);
    const before = readFileSync(
      join(dir, "criada-fases-da-escola.json"),
      "utf8",
    );
    teacher.socket.send(
      JSON.stringify({
        type: "updateTheme",
        id: "criada-fases-da-escola",
        line: line({ titulo: "" }),
      }),
    );
    await expect
      .poll(() => lastError(teacher.received))
      .toContain("Dê um nome ao tema da linha.");
    expect(readFileSync(join(dir, "criada-fases-da-escola.json"), "utf8")).toBe(
      before,
    );
  });

  it("só edita linhas criadas no painel, nunca as atividades prontas", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const before = readFileSync(join(dir, "ciclo-da-agua.json"), "utf8");
    teacher.socket.send(
      JSON.stringify({
        type: "updateTheme",
        id: "ciclo-da-agua",
        line: line(),
      }),
    );
    await expect.poll(() => lastError(teacher.received)).toBeTruthy();
    expect(readFileSync(join(dir, "ciclo-da-agua.json"), "utf8")).toBe(before);
    expect(latest(teacher.received)?.title).not.toBe("Fases da escola");
  });

  it("apaga a linha: tira do menu, apaga o arquivo e volta ao tema inicial se ela estava em uso", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-apagar-1",
    });
    await createLine(teacher);
    expect(latest(teacher.received)?.themeId).toBe("criada-fases-da-escola");
    teacher.socket.send(
      JSON.stringify({ type: "deleteTheme", id: "criada-fases-da-escola" }),
    );
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(0);
    const snapshot = latest(teacher.received)!;
    expect(snapshot.themeId).toBe("ciclo-da-agua");
    expect(
      snapshot.themes?.some((t) => t.id === "criada-fases-da-escola"),
    ).toBe(false);
    await expect
      .poll(() => latest(student.received)?.themeId)
      .toBe("ciclo-da-agua");
    expect(files()).toEqual([]);
  });

  it("apagar uma linha que não está em uso não troca o tema da turma", async () => {
    const { port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    await createLine(teacher);
    teacher.socket.send(
      JSON.stringify({ type: "theme", themeId: "ciclo-da-agua" }),
    );
    await expect
      .poll(() => latest(teacher.received)?.themeId)
      .toBe("ciclo-da-agua");
    teacher.socket.send(
      JSON.stringify({ type: "deleteTheme", id: "criada-fases-da-escola" }),
    );
    await expect
      .poll(() => latest(teacher.received)?.customLines?.length)
      .toBe(0);
    expect(latest(teacher.received)?.themeId).toBe("ciclo-da-agua");
  });

  it("não apaga atividades prontas, não apaga por aluno e não apaga depois de iniciar", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-apagar-2",
    });
    await createLine(teacher);
    teacher.socket.send(
      JSON.stringify({ type: "deleteTheme", id: "ciclo-da-agua" }),
    );
    await expect.poll(() => lastError(teacher.received)).toBeTruthy();
    expect(existsSync(join(dir, "ciclo-da-agua.json"))).toBe(true);

    student.socket.send(
      JSON.stringify({ type: "deleteTheme", id: "criada-fases-da-escola" }),
    );
    await expect.poll(() => lastError(student.received)).toBeTruthy();
    expect(files()).toEqual(["criada-fases-da-escola.json"]);

    teacher.socket.send(JSON.stringify({ type: "status", status: "active" }));
    await expect.poll(() => latest(teacher.received)?.status).toBe("active");
    teacher.socket.send(
      JSON.stringify({ type: "deleteTheme", id: "criada-fases-da-escola" }),
    );
    await expect
      .poll(() => lastError(teacher.received))
      .toMatch(/antes de iniciar/);
    expect(files()).toEqual(["criada-fases-da-escola.json"]);
  });
});
