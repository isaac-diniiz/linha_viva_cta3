// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { attachDemoServer } from "./server";

type Message = { type: string; message?: string };

describe("servidor da demonstração", () => {
  let server: Server | null = null;
  const sockets: WebSocket[] = [];
  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    await new Promise((done) => server?.close(done) ?? done(null));
    server = null;
  });

  async function start() {
    server = createServer();
    const { code } = attachDemoServer(server, {
      activitiesDir: resolve("atividades"),
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
});
