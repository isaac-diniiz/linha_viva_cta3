import type { Plugin, ViteDevServer } from "vite";
import { randomBytes } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { acceptPreview, expirePreviews, type Preview } from "../domain/preview";
import {
  assignStudent,
  canAcceptDemoPreview,
  confirmDemoMove,
  createDemoState,
  setDemoStatus,
  type DemoStatus,
} from "./domain";

type Role = "teacher" | "projection" | "student";
type Client = { role: Role; token?: string };

export function attachDemoServer(
  httpServer: NonNullable<ViteDevServer["httpServer"]>,
  {
    publicMode = false,
    teacherKey = randomBytes(24).toString("hex"),
  }: { publicMode?: boolean; teacherKey?: string } = {},
) {
  const projectionKey = randomBytes(24).toString("hex");
  const newState = () => {
    const result = createDemoState();
    if (publicMode) result.code = randomBytes(4).toString("hex").toUpperCase();
    return result;
  };
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16_384 });
  const clients = new Map<WebSocket, Client>();
  let state = newState();

  const send = (socket: WebSocket, message: unknown) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  const snapshot = (client: Client) => ({
    type: "snapshot",
    state: {
      code: state.code,
      title: state.title,
      instruction: state.instruction,
      items: state.items,
      confirmedOrder: state.confirmedOrder,
      confirmedPositions: state.confirmedPositions,
      status: state.status,
      version: state.version,
      previewVersionFloor: state.previewVersionFloor,
      revealed: state.revealed,
      previews: state.previews,
      memberCount: Object.keys(state.members).length,
      reference:
        client.role === "teacher" || state.revealed
          ? [...state.items]
              .sort(
                (a, b) =>
                  ["evaporacao", "condensacao", "precipitacao"].indexOf(
                    a.templateId,
                  ) -
                  ["evaporacao", "condensacao", "precipitacao"].indexOf(
                    b.templateId,
                  ),
              )
              .map((item) => item.id)
          : undefined,
      ownItemId:
        client.role === "student" && client.token
          ? state.members[client.token]
          : client.role === "teacher"
            ? state.teacherItemId
            : undefined,
      projectionKey: client.role === "teacher" ? projectionKey : undefined,
    },
  });
  const publish = () => {
    for (const [socket, client] of clients) send(socket, snapshot(client));
  };
  const publishPreview = (itemId: string) => {
    const message = {
      type: "preview",
      itemId,
      preview: state.previews[itemId] ?? null,
    };
    for (const socket of clients.keys()) send(socket, message);
  };
  const fail = (socket: WebSocket, error: unknown, requestId?: string) =>
    send(socket, {
      type: requestId ? "ack" : "error",
      requestId,
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
    });

  httpServer.on("upgrade", (request, socket, head) => {
    if (new URL(request.url ?? "/", "http://localhost").pathname !== "/demo-ws")
      return;
    wss.handleUpgrade(request, socket, head, (connection) =>
      wss.emit("connection", connection),
    );
  });

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (message.type === "join") {
          const role = message.role;
          if (role !== "teacher" && role !== "projection" && role !== "student")
            throw new Error("Papel inválido.");
          const client: Client = { role };
          if (publicMode && role === "teacher" && message.key !== teacherKey)
            throw new Error("Chave do professor inválida.");
          if (
            publicMode &&
            role === "projection" &&
            message.key !== projectionKey
          )
            throw new Error("Chave da projeção inválida.");
          if (role === "student") {
            if (String(message.code ?? "").toUpperCase() !== state.code)
              throw new Error("Código da turma inválido.");
            const token = String(message.token ?? "");
            if (token.length < 8 || token.length > 80)
              throw new Error("Identidade temporária inválida.");
            if (
              !state.members[token] &&
              Object.keys(state.members).length >= 40
            )
              throw new Error("A demonstração atingiu o limite de 40 alunos.");
            client.token = token;
            assignStudent(state, token);
          }
          if (client.token) {
            for (const [existingSocket, existing] of clients)
              if (existing.token === client.token && existingSocket !== socket)
                existingSocket.close();
          }
          clients.set(socket, client);
          publish();
          return;
        }
        const client = clients.get(socket);
        if (!client)
          throw new Error("Entre na demonstração antes de continuar.");
        if (message.type === "move" || message.type === "cancel") {
          if (client.role === "projection")
            throw new Error("A projeção é somente leitura.");
          const itemId =
            client.role === "teacher"
              ? state.teacherItemId
              : state.members[client.token ?? ""];
          if (!itemId || state.status !== "active")
            throw new Error("Movimentos indisponíveis.");
          const preview = message.preview as Preview;
          if (
            !preview ||
            !canAcceptDemoPreview(state, preview.version) ||
            !Number.isFinite(preview.x) ||
            !Number.isFinite(preview.y)
          )
            return;
          if (message.type === "cancel") {
            if (state.previews[itemId]?.dragId === preview.dragId)
              delete state.previews[itemId];
          } else
            state.previews = acceptPreview(
              state.previews,
              itemId,
              { ...preview, receivedAt: Date.now() },
              preview.version,
            );
          publishPreview(itemId);
          return;
        }
        if (message.type === "confirm") {
          if (client.role === "projection")
            throw new Error("A projeção é somente leitura.");
          const version = confirmDemoMove(
            state,
            client.token ?? "",
            Number(message.x),
            Number(message.version),
            client.role === "teacher",
          );
          send(socket, {
            type: "ack",
            requestId: message.requestId,
            ok: true,
            version,
          });
          publish();
          return;
        }
        if (client.role !== "teacher")
          throw new Error("A projeção é somente leitura.");
        if (message.type === "status") {
          if (!["active", "paused", "ended"].includes(String(message.status)))
            throw new Error("Estado inválido.");
          setDemoStatus(state, message.status as DemoStatus);
        } else if (message.type === "reveal") {
          state.revealed = true;
          state.version++;
        } else if (message.type === "reset") {
          state = newState();
          for (const connected of clients.values())
            if (connected.role === "student" && connected.token)
              assignStudent(state, connected.token);
        } else throw new Error("Ação desconhecida.");
        publish();
      } catch (error) {
        const requestId = (() => {
          try {
            return (JSON.parse(raw.toString()) as { requestId?: string })
              .requestId;
          } catch {
            return undefined;
          }
        })();
        fail(socket, error, requestId);
      }
    });
    socket.on("close", () => {
      const client = clients.get(socket);
      const itemId =
        client?.role === "teacher"
          ? state.teacherItemId
          : client?.token
            ? state.members[client.token]
            : undefined;
      if (itemId) delete state.previews[itemId];
      clients.delete(socket);
      publish();
    });
  });

  const timer = setInterval(() => {
    const next = expirePreviews(state.previews, Date.now(), 2000);
    if (Object.keys(next).length !== Object.keys(state.previews).length) {
      state.previews = next;
      publish();
    }
  }, 250);
  httpServer.on("close", () => {
    clearInterval(timer);
    for (const socket of clients.keys()) socket.terminate();
    wss.close();
  });
  return { teacherKey, projectionKey, code: state.code };
}

export function localDemoPlugin(): Plugin {
  return {
    name: "linha-viva-local-demo",
    apply: "serve",
    configureServer(vite) {
      if (vite.httpServer) attachDemoServer(vite.httpServer);
    },
  };
}
