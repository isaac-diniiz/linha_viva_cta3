import { useRef, useState } from "react";
import { Board } from "../../components/Board";
import { DragCard } from "../../components/DragCard";
import { ThemePicker } from "../../components/ThemePicker";
import type { Preview } from "../../domain/preview";
import { useLocalDemo } from "../client";
import { boardData, Connection, Header, isSharedCard } from "../shared";

export function Teacher() {
  const { state, connected, error, send, confirm, preview } =
    useLocalDemo("teacher");
  const [message, setMessage] = useState("");
  const [localPreview, setLocalPreview] = useState<Preview | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const sharedCard = isSharedCard(state);
  const action = (payload: unknown) => {
    try {
      send(payload);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <main className="app-shell demo-shell">
      <Header role="PROFESSOR" />
      <Connection connected={connected} error={error} />
      <section className="demo-heading">
        <div>
          <div className="eyebrow">
            CÓDIGO DA TURMA · {state?.code ?? "DEMO1234"}
          </div>
          <h1>{state?.title ?? "Preparando atividade…"}</h1>
        </div>
        <a
          className="button secondary"
          href={`/demo/projetor?key=${encodeURIComponent(state?.projectionKey ?? "")}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir projeção ↗
        </a>
      </section>
      {state && (
        <div className="notice" role="status">
          Compartilhe com os alunos:{" "}
          <a href={`/demo/aluno/${state.code}`}>
            {`${location.origin}/demo/aluno/${state.code}`}
          </a>
          . {state.memberCount} aluno(s) conectado(s).
        </div>
      )}
      {state?.themes && (
        <ThemePicker
          themes={state.themes}
          selectedId={state.themeId}
          disabled={!connected || state.status !== "waiting"}
          onChoose={(themeId) => action({ type: "theme", themeId })}
        />
      )}
      <div className="demo-controls">
        <button
          className="button primary"
          disabled={
            !connected ||
            !state ||
            state.status === "active" ||
            state.status === "ended"
          }
          onClick={() => action({ type: "status", status: "active" })}
        >
          {state?.status === "paused"
            ? "Retomar atividade"
            : "Iniciar atividade"}
        </button>
        <button
          className="button secondary"
          disabled={!connected || state?.status !== "active"}
          onClick={() => action({ type: "status", status: "paused" })}
        >
          Pausar movimentos
        </button>
        <button
          className="button secondary"
          disabled={!connected || !state || state.revealed}
          onClick={() => action({ type: "reveal" })}
        >
          Revelar referência
        </button>
        <button
          className="button secondary"
          disabled={!connected || state?.status === "ended"}
          onClick={() => action({ type: "status", status: "ended" })}
        >
          Encerrar
        </button>
        <button
          className="button secondary"
          disabled={!connected}
          onClick={() => action({ type: "reset" })}
        >
          Reiniciar demonstração
        </button>
      </div>
      {message && (
        <div className="notice error" role="alert">
          {message}
        </div>
      )}
      <Board
        ref={boardRef}
        {...boardData(state)}
        previews={
          localPreview && state?.ownItemId
            ? { ...state.previews, [state.ownItemId]: localPreview }
            : (state?.previews ?? {})
        }
      />
      {state?.ownItemId && (
        <section className="own-item-panel">
          <div className="section-label">Seu cartão, diferente dos alunos</div>
          <DragCard
            label={
              state.items.find((item) => item.id === state.ownItemId)?.label ??
              "Item"
            }
            boardRef={boardRef}
            version={state.version}
            disabled={!connected || state.status !== "active"}
            onLocalPreview={setLocalPreview}
            onPreview={preview}
            onDrop={async (x, version) => {
              try {
                await confirm(x, version);
                setMessage(
                  sharedCard
                    ? "Seu voto foi registrado. A caixa fica no consenso de quem tem o mesmo cartão."
                    : "Seu cartão foi colocado na linha.",
                );
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setLocalPreview(null);
              }
            }}
          />
        </section>
      )}
      {state?.revealed && (
        <div className="notice" role="status">
          Referência: {state.reference?.join(" → ")}
        </div>
      )}
    </main>
  );
}
