import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptPreview,
  type Preview,
  type PreviewState,
} from "../domain/preview";
import { newId } from "../domain/id";
import {
  canAcceptDemoPreview,
  type DemoStatus,
  type LineCard,
  type ThemeSummary,
} from "./domain";

export type DemoSnapshot = {
  code: string;
  title: string;
  instruction: string;
  axis: { start: string; end: string };
  themeId: string;
  /** Temas disponíveis; só o professor recebe a lista. */
  themes?: ThemeSummary[];
  items: { id: string; label: string }[];
  confirmedOrder: string[];
  confirmedPositions: Record<string, number>;
  cards: LineCard[];
  status: DemoStatus;
  version: number;
  previewVersionFloor: number;
  revealed: boolean;
  previews: PreviewState;
  memberCount: number;
  /** Etapas da referência, já em texto, uma por cartão. */
  reference?: string[];
  ownItemId?: string;
  projectionKey?: string;
};
type Role = "teacher" | "projection" | "student";

function studentToken(): string {
  let token = localStorage.getItem("linha-viva-demo-student");
  if (!token) {
    token = newId();
    localStorage.setItem("linha-viva-demo-student", token);
  }
  return token;
}

export function useLocalDemo(role: Role, code = "DEMO1234") {
  const key = new URLSearchParams(location.search).get("key") ?? "";
  const [state, setState] = useState<DemoSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const pending = useRef(
    new Map<string, { resolve: () => void; reject: (error: Error) => void }>(),
  );

  useEffect(() => {
    let alive = true;
    let retry: number;
    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${location.host}/demo-ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        if (alive) setConnected(true);
        socket.send(
          JSON.stringify({
            type: "join",
            role,
            code,
            key,
            token: role === "student" ? studentToken() : undefined,
          }),
        );
      };
      socket.onmessage = ({ data }) => {
        const message = JSON.parse(String(data));
        if (message.type === "snapshot") {
          setState(message.state);
          setError("");
        }
        if (message.type === "preview") {
          setState((current) => {
            if (!current) return current;
            if (
              message.preview &&
              !canAcceptDemoPreview(current, message.preview.version)
            )
              return current;
            const previews = message.preview
              ? acceptPreview(
                  current.previews,
                  message.itemId,
                  { ...message.preview, receivedAt: Date.now() },
                  message.preview.version,
                )
              : Object.fromEntries(
                  Object.entries(current.previews).filter(
                    ([id]) => id !== message.itemId,
                  ),
                );
            if (previews === current.previews) return current;
            return { ...current, previews };
          });
        }
        if (message.type === "error") setError(message.message);
        if (message.type === "ack") {
          const request = pending.current.get(message.requestId);
          if (request) {
            pending.current.delete(message.requestId);
            if (message.ok) request.resolve();
            else request.reject(new Error(message.message));
          }
        }
      };
      socket.onclose = () => {
        if (!alive) return;
        setConnected(false);
        for (const request of pending.current.values())
          request.reject(new Error("Conexão interrompida."));
        pending.current.clear();
        retry = window.setTimeout(connect, 1200);
      };
      socket.onerror = () =>
        setError(
          "Conexão indisponível. Verifique o link e se a demonstração está ativa.",
        );
    };
    connect();
    return () => {
      alive = false;
      window.clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [role, code, key]);

  const send = useCallback((message: unknown) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN)
      throw new Error("Conexão indisponível.");
    socketRef.current.send(JSON.stringify(message));
  }, []);
  const confirm = useCallback(
    (x: number, version: number) =>
      new Promise<void>((resolve, reject) => {
        const requestId = newId();
        pending.current.set(requestId, { resolve, reject });
        try {
          send({ type: "confirm", x, version, requestId });
        } catch (error) {
          pending.current.delete(requestId);
          reject(error);
        }
      }),
    [send],
  );
  const preview = useCallback(
    (value: Preview, event: "move" | "cancel") => {
      if (socketRef.current?.readyState === WebSocket.OPEN)
        send({ type: event, preview: value });
    },
    [send],
  );
  return { state, connected, error, send, confirm, preview };
}
