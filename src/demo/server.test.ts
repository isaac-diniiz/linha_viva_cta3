// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { signSession } from "./auth";
import { attachDemoServer } from "./server";

const SECRET = "segredo-de-teste-com-tamanho-suficiente";

type Message = {
  type: string;
  message?: string;
  requestId?: string;
  ok?: boolean;
  state?: {
    status: string;
    version: number;
    cardsPerParticipant: number;
    teacherPlays: boolean;
    ownItemIds?: string[];
    ownPlacedIds?: string[];
  };
};

describe("servidor da demonstração", () => {
  let server: Server | null = null;
  const sockets: WebSocket[] = [];
  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    await new Promise((done) => server?.close(done) ?? done(null));
    server = null;
  });

  async function start(publicMode = false) {
    server = createServer();
    const { code } = attachDemoServer(server, {
      activitiesDir: resolve("atividades"),
      theme: "ciclo-da-agua",
      publicMode,
      sessionSecret: SECRET,
    });
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

  it("aceita a pulsação de aluno e projeção sem erro e sem republicar a linha", async () => {
    const { code, port } = await start();
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-pulsacao",
    });
    const projection = await connect(port, { role: "projection" });
    const before = [student.received.length, projection.received.length];
    student.socket.send(JSON.stringify({ type: "ping" }));
    projection.socket.send(JSON.stringify({ type: "ping" }));
    await new Promise((done) => setTimeout(done, 150));
    expect(student.received.slice(before[0])).toEqual([]);
    expect(projection.received.slice(before[1])).toEqual([]);
  });

  it("entrega vários cartões ao aluno, que confirma cada um e não mexe no cartão alheio", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const latest = (received: Message[]) =>
      [...received].reverse().find((message) => message.type === "snapshot")
        ?.state;
    teacher.socket.send(
      JSON.stringify({ type: "cardsPerParticipant", value: 2 }),
    );
    await expect
      .poll(() => latest(teacher.received)?.cardsPerParticipant)
      .toBe(2);
    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-varios",
    });
    await expect
      .poll(() => latest(student.received)?.ownItemIds?.length)
      .toBe(2);
    const [, second] = latest(student.received)!.ownItemIds!;
    const teacherCard = latest(teacher.received)!.ownItemIds![0];
    teacher.socket.send(JSON.stringify({ type: "status", status: "active" }));
    await expect.poll(() => latest(student.received)?.status).toBe("active");

    const confirm = (itemId: string, requestId: string) =>
      student.socket.send(
        JSON.stringify({
          type: "confirm",
          itemId,
          x: 0.6,
          version: latest(student.received)!.version,
          requestId,
        }),
      );
    const ack = (requestId: string) =>
      student.received.find(
        (message) => message.type === "ack" && message.requestId === requestId,
      );
    confirm(teacherCard, "alheio");
    await expect.poll(() => ack("alheio")?.ok).toBe(false);
    expect(ack("alheio")?.message).toMatch(/não é seu/);
    confirm(second, "proprio");
    await expect.poll(() => ack("proprio")?.ok).toBe(true);
    await expect
      .poll(() => latest(student.received)?.ownPlacedIds)
      .toEqual([second]);
  });

  it("professor deixa de participar com cartões, a escolha resiste ao reinício e aluno não a altera", async () => {
    const { code, port } = await start();
    const teacher = await connect(port, { role: "teacher" });
    const latest = (received: Message[]) =>
      [...received].reverse().find((message) => message.type === "snapshot")
        ?.state;
    teacher.socket.send(JSON.stringify({ type: "teacherPlays", value: false }));
    await expect.poll(() => latest(teacher.received)?.teacherPlays).toBe(false);
    expect(latest(teacher.received)?.ownItemIds).toEqual([]);
    teacher.socket.send(JSON.stringify({ type: "reset" }));
    await expect.poll(() => latest(teacher.received)?.version).toBe(0);
    expect(latest(teacher.received)?.teacherPlays).toBe(false);

    const student = await connect(port, {
      role: "student",
      code,
      token: "aluno-intruso",
    });
    student.socket.send(JSON.stringify({ type: "teacherPlays", value: true }));
    await expect
      .poll(() => student.received.some((message) => message.type === "error"))
      .toBe(true);
    expect(latest(teacher.received)?.teacherPlays).toBe(false);
  });

  it("no modo público, o professor só entra com sessão válida, sem chave no link", async () => {
    const { port } = await start(true);
    const anonymous = await connect(port, { role: "teacher" });
    expect(anonymous.received.at(-1)).toMatchObject({
      type: "error",
      message: "Entre como professor.",
    });
    const forged = signSession(
      { email: "intruso@x.br" },
      "outro-segredo-qualquer-bem-longo",
      Date.now(),
    );
    const intruder = await connect(
      port,
      { role: "teacher" },
      `lv_professor=${forged}`,
    );
    expect(intruder.received.at(-1)?.type).toBe("error");
    const token = signSession({ email: "ana@escola.br" }, SECRET, Date.now());
    const teacher = await connect(
      port,
      { role: "teacher" },
      `lv_professor=${token}`,
    );
    expect(teacher.received.at(-1)?.type).toBe("snapshot");
  });
});
