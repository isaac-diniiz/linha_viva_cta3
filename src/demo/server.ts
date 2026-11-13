import type { Plugin, ViteDevServer } from "vite";
import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { resolve } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { acceptPreview, expirePreviews, type Preview } from "../domain/preview";
import { parseActivity, type Theme } from "./activity";
import { teacherFromCookie } from "./auth";
import { activityFileIds, findTheme, loadActivities } from "./catalog";
import {
  createCustomActivity,
  isCustomLineId,
  lineFormOf,
  type CustomLineEntry,
} from "./customLine";
import { fileLineStore, type LineStore, type StoredLine } from "./lineStore";
import {
  assignStudent,
  canAcceptDemoPreview,
  confirmDemoMove,
  changeTheme,
  createDemoState,
  dealOf,
  INVALID_CODE_MESSAGE,
  lineCards,
  listThemes,
  ownedItems,
  referenceLabels,
  resolveOwnItem,
  setCardsPerParticipant,
  setTeacherPlays,
  setDemoStatus,
  type Deal,
  type DemoStatus,
} from "./domain";

type Role = "teacher" | "projection" | "student";
/** `email`: professor logado; nulo no uso local, sem login. */
type Client = { role: Role; token?: string; email?: string | null };

/** Id de cartão vindo do cliente; ausente quando o participante tem um só. */
function optionalId(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const DEFAULT_THEME_ID = "ciclo-da-agua";
/** Limite de atividades no menu, para o catálogo não crescer sem controle. */
const MAX_THEMES = 100;

/**
 * Carrega o catálogo, avisa sobre arquivos rejeitados e escolhe o tema inicial.
 * Com `customFromFiles` falso (linhas no Supabase), os arquivos `criada-*` da
 * pasta ficam de fora: as linhas criadas vêm só do armazenamento.
 */
function prepareCatalog(
  dir: string,
  preferredId: string | undefined,
  customFromFiles: boolean,
) {
  const catalog = loadActivities(dir);
  if (!customFromFiles)
    catalog.themes = catalog.themes.filter(
      (theme) => !isCustomLineId(theme.id),
    );
  for (const { file, errors } of catalog.rejected)
    console.warn(
      `Atividade rejeitada (${file}):\n${errors.map((error) => `  - ${error}`).join("\n")}`,
    );
  if (catalog.themes.length === 0)
    throw new Error(`Nenhuma atividade válida em ${dir}.`);
  const preferred = catalog.themes.find((theme) => theme.id === preferredId);
  if (preferredId && !preferred)
    console.warn(`Tema inicial "${preferredId}" não encontrado no catálogo.`);
  const initial =
    preferred ??
    catalog.themes.find((theme) => theme.id === DEFAULT_THEME_ID) ??
    catalog.themes[0];
  return { themes: catalog.themes, initial };
}

/** Linhas criadas no painel, no formato do formulário, para o professor editar. */
function customLinesOf(themes: Theme[]): CustomLineEntry[] {
  return themes.map((theme) => ({ id: theme.id, ...lineFormOf(theme) }));
}

/** Id do pedido, para a resposta falha chegar a quem a esperava. */
function requestIdOf(raw: { toString(): string }): string | undefined {
  try {
    return (JSON.parse(raw.toString()) as { requestId?: string }).requestId;
  } catch {
    return undefined;
  }
}

export function attachDemoServer(
  httpServer: NonNullable<ViteDevServer["httpServer"]>,
  {
    publicMode = false,
    sessionSecret,
    theme = process.env.LINHA_VIVA_TEMA,
    activitiesDir = process.env.LINHA_VIVA_ATIVIDADES ?? resolve("atividades"),
    lines = fileLineStore(activitiesDir),
  }: {
    publicMode?: boolean;
    /** Segredo das sessões de professor; no modo público, sem ele ninguém conduz. */
    sessionSecret?: string;
    theme?: string;
    activitiesDir?: string;
    /** Onde ficam as linhas criadas pelo professor; por padrão, arquivos em `activitiesDir`. */
    lines?: LineStore;
  } = {},
) {
  const catalog = prepareCatalog(
    activitiesDir,
    theme,
    lines.source === "arquivos",
  );
  const projectionKey = randomBytes(24).toString("hex");
  const newState = (selected: Theme = catalog.initial, deal?: Deal) => {
    const result = createDemoState(selected, Math.random, deal);
    if (publicMode) result.code = randomBytes(4).toString("hex").toUpperCase();
    return result;
  };
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16_384 });
  const clients = new Map<WebSocket, Client>();
  let state = newState();
  // Dono de cada linha criada. Linha sem dono conhecido (uso local, ou arquivo
  // lido da pasta) fica com todos os professores.
  const owners = new Map<string, string | null>();
  const isMine = (id: string, email: string | null) => {
    const owner = owners.get(id) ?? null;
    return owner === null || owner === email;
  };
  /** Atividades prontas e as linhas do professor; o tema em uso sempre aparece. */
  const themesFor = (email: string | null) =>
    catalog.themes.filter(
      (theme) =>
        !isCustomLineId(theme.id) ||
        isMine(theme.id, email) ||
        theme.id === state.themeId,
    );
  const ownLinesOf = (email: string | null) =>
    catalog.themes.filter(
      (theme) => isCustomLineId(theme.id) && isMine(theme.id, email),
    );

  // As linhas criadas são gravadas uma de cada vez: cada ação confere o estado,
  // grava no armazenamento e só então muda o menu, e o início da atividade espera.
  let lineQueue: Promise<void> = Promise.resolve();
  let savingLines = 0;

  const send = (socket: WebSocket, message: unknown) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  const ownOf = (client: Client) =>
    client.role === "projection"
      ? undefined
      : ownedItems(state, client.token ?? "", client.role === "teacher");
  const snapshot = (client: Client, own = ownOf(client)) => ({
    type: "snapshot",
    state: {
      code: state.code,
      title: state.title,
      instruction: state.instruction,
      axis: state.axis,
      themeId: state.themeId,
      themes:
        client.role === "teacher"
          ? listThemes(themesFor(client.email ?? null))
          : undefined,
      // só o professor recebe as linhas que criou, com os cartões na ordem certa, para editar
      customLines:
        client.role === "teacher"
          ? customLinesOf(ownLinesOf(client.email ?? null))
          : undefined,
      linesStorage: client.role === "teacher" ? lines.source : undefined,
      items: state.items,
      confirmedOrder: state.confirmedOrder,
      confirmedPositions: state.confirmedPositions,
      status: state.status,
      version: state.version,
      previewVersionFloor: state.previewVersionFloor,
      revealed: state.revealed,
      previews: state.previews,
      memberCount: Object.keys(state.members).length,
      cards: lineCards(state),
      reference:
        client.role === "teacher" || state.revealed
          ? referenceLabels(state)
          : undefined,
      cardsPerParticipant: state.cardsPerParticipant,
      teacherPlays: state.teacherPlays,
      ownItemIds: own,
      // só os próprios cartões: o aluno vê quais já pôs na linha, sem ver os votos alheios
      ownPlacedIds: own?.filter((id) => state.votes[id] !== undefined),
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

  const queueLineAction = (
    socket: WebSocket,
    raw: { toString(): string },
    action: () => Promise<void>,
  ) => {
    savingLines++;
    lineQueue = lineQueue
      .then(action)
      .then(publish)
      .catch((error) => fail(socket, error, requestIdOf(raw)))
      .finally(() => {
        savingLines--;
      });
  };

  // linhas guardadas no armazenamento entram no menu assim que chegam
  const ready = (async () => {
    let saved: StoredLine[];
    try {
      saved = await lines.load();
    } catch (error) {
      console.warn(
        `Não foi possível carregar as linhas criadas: ${(error as Error).message}`,
      );
      return;
    }
    let added = 0;
    for (const { activity: raw, owner } of saved) {
      const parsed = parseActivity(raw);
      if (!parsed.ok) {
        console.warn(
          `Linha guardada rejeitada:\n${parsed.errors.map((error) => `  - ${error}`).join("\n")}`,
        );
        continue;
      }
      const id = parsed.theme.id;
      if (
        !isCustomLineId(id) ||
        catalog.themes.some((existing) => existing.id === id) ||
        catalog.themes.length >= MAX_THEMES
      ) {
        console.warn(`Linha guardada ignorada: ${id}.`);
        continue;
      }
      catalog.themes.push(parsed.theme);
      owners.set(id, owner);
      added++;
    }
    if (added) publish();
  })();

  httpServer.on("upgrade", (request, socket, head) => {
    if (new URL(request.url ?? "/", "http://localhost").pathname !== "/demo-ws")
      return;
    wss.handleUpgrade(request, socket, head, (connection) =>
      wss.emit("connection", connection, request),
    );
  });

  wss.on("connection", (socket, request: IncomingMessage) => {
    // o cookie de sessão chega no pedido de abertura do WebSocket
    const teacher = sessionSecret
      ? teacherFromCookie(request.headers.cookie, sessionSecret, Date.now())
      : null;
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as Record<string, unknown>;
        // pulsação dos clientes: só mantém o serviço hospedado acordado
        if (message.type === "ping") return;
        if (message.type === "join") {
          const role = message.role;
          if (role !== "teacher" && role !== "projection" && role !== "student")
            throw new Error("Papel inválido.");
          const client: Client = { role };
          if (role === "teacher") client.email = teacher?.email ?? null;
          if (publicMode && role === "teacher" && !teacher)
            throw new Error("Entre como professor.");
          if (
            publicMode &&
            role === "projection" &&
            message.key !== projectionKey
          )
            throw new Error("Chave da projeção inválida.");
          if (role === "student") {
            if (String(message.code ?? "").toUpperCase() !== state.code)
              throw new Error(INVALID_CODE_MESSAGE);
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
          if (state.status !== "active")
            throw new Error("Movimentos indisponíveis.");
          const itemId = resolveOwnItem(
            state,
            client.token ?? "",
            optionalId(message.itemId),
            client.role === "teacher",
          );
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
            {
              itemId: optionalId(message.itemId),
              asTeacher: client.role === "teacher",
            },
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
        const email = client.email ?? null;
        if (message.type === "status") {
          if (!["active", "paused", "ended"].includes(String(message.status)))
            throw new Error("Estado inválido.");
          if (savingLines > 0)
            throw new Error("Aguarde a linha terminar de salvar.");
          setDemoStatus(state, message.status as DemoStatus);
        } else if (message.type === "reveal") {
          state.revealed = true;
          state.version++;
        } else if (message.type === "theme") {
          state = changeTheme(
            state,
            findTheme(themesFor(email), String(message.themeId)),
          );
        } else if (message.type === "createTheme") {
          queueLineAction(socket, raw, async () => {
            if (state.status !== "waiting")
              throw new Error(
                "Só é possível criar uma linha antes de iniciar a atividade.",
              );
            if (catalog.themes.length >= MAX_THEMES)
              throw new Error(`O menu já tem ${MAX_THEMES} atividades.`);
            const created = createCustomActivity(message.line, [
              ...catalog.themes.map((existing) => existing.id),
              ...activityFileIds(activitiesDir),
            ]);
            if (!created.ok) throw new Error(created.errors.join(" "));
            const persisted = await lines.create(
              created.theme.id,
              created.raw,
              email,
            );
            if (!persisted)
              console.warn(
                `A linha "${created.theme.title}" vale só até o servidor reiniciar.`,
              );
            catalog.themes.push(created.theme);
            owners.set(created.theme.id, email);
            state = changeTheme(state, created.theme);
          });
          return;
        } else if (message.type === "updateTheme") {
          queueLineAction(socket, raw, async () => {
            if (state.status !== "waiting")
              throw new Error(
                "Só é possível editar uma linha antes de iniciar a atividade.",
              );
            const id = message.id;
            if (
              !isCustomLineId(id) ||
              !catalog.themes.some((existing) => existing.id === id)
            )
              throw new Error("Só dá para editar as linhas criadas no painel.");
            if (!isMine(id, email))
              throw new Error("Só dá para editar as linhas criadas por você.");
            const edited = createCustomActivity(message.line, [], id);
            if (!edited.ok) throw new Error(edited.errors.join(" "));
            // editar não troca o dono da linha
            const persisted = await lines.replace(
              id,
              edited.raw,
              owners.get(id) ?? null,
            );
            if (!persisted)
              console.warn(
                `A edição de "${edited.theme.title}" vale só até o servidor reiniciar.`,
              );
            const index = catalog.themes.findIndex(
              (existing) => existing.id === id,
            );
            if (index >= 0) catalog.themes[index] = edited.theme;
            // a turma só recebe cartões novos se a linha editada é a que está em uso
            if (state.themeId === id) state = changeTheme(state, edited.theme);
          });
          return;
        } else if (message.type === "deleteTheme") {
          queueLineAction(socket, raw, async () => {
            if (state.status !== "waiting")
              throw new Error(
                "Só é possível apagar uma linha antes de iniciar a atividade.",
              );
            const id = message.id;
            if (
              !isCustomLineId(id) ||
              !catalog.themes.some((existing) => existing.id === id)
            )
              throw new Error("Só dá para apagar as linhas criadas no painel.");
            if (!isMine(id, email))
              throw new Error("Só dá para apagar as linhas criadas por você.");
            if (catalog.themes.length <= 1)
              throw new Error(
                "O menu precisa ficar com pelo menos uma atividade.",
              );
            await lines.remove(id);
            owners.delete(id);
            catalog.themes.splice(
              catalog.themes.findIndex((existing) => existing.id === id),
              1,
            );
            if (state.themeId === id)
              state = changeTheme(
                state,
                catalog.themes.find((theme) => theme.id === DEFAULT_THEME_ID) ??
                  catalog.themes[0],
              );
          });
          return;
        } else if (message.type === "teacherPlays") {
          state = setTeacherPlays(state, message.value as boolean);
        } else if (message.type === "cardsPerParticipant") {
          state = setCardsPerParticipant(state, Number(message.value));
        } else if (message.type === "reset") {
          state = newState(state.theme, dealOf(state));
          for (const connected of clients.values())
            if (connected.role === "student" && connected.token)
              assignStudent(state, connected.token);
        } else throw new Error("Ação desconhecida.");
        publish();
      } catch (error) {
        fail(socket, error, requestIdOf(raw));
      }
    });
    socket.on("close", () => {
      const client = clients.get(socket);
      for (const itemId of client ? (ownOf(client) ?? []) : [])
        delete state.previews[itemId];
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
  return { projectionKey, code: state.code, ready };
}

export function localDemoPlugin(): Plugin {
  return {
    name: "linha-viva-local-demo",
    apply: "serve",
    configureServer(vite) {
      if (vite.httpServer) attachDemoServer(vite.httpServer);
      // modo local sem login: o painel do professor abre direto
      vite.middlewares.use("/demo/api/eu", (_request, response) => {
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ email: null }));
      });
    },
  };
}
