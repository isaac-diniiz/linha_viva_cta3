import { useRef, useState } from "react";
import { Board } from "../../components/Board";
import { ThemePicker } from "../../components/ThemePicker";
import type { Preview } from "../../domain/preview";
import { useLocalDemo } from "../client";
import { MAX_CARDS_PER_PARTICIPANT } from "../domain";
import {
  boardData,
  Connection,
  Header,
  isSharedCard,
  OwnCards,
  ownCards,
  placedMessage,
  replacePreview,
  withLocalPreviews,
} from "../shared";

export function Teacher() {
  const { state, connected, error, send, confirm, preview } =
    useLocalDemo("teacher");
  const [message, setMessage] = useState("");
  const [localPreviews, setLocalPreviews] = useState<Record<string, Preview>>(
    {},
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const cards = ownCards(state);
  const setLocalPreview = (itemId: string, preview: Preview | null) =>
    setLocalPreviews((current) => replacePreview(current, itemId, preview));
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
      {state && (
        <div className="cards-per-participant">
          <label htmlFor="demo-cards-per-participant">
            Cartões por participante
          </label>
          <select
            id="demo-cards-per-participant"
            value={state.cardsPerParticipant}
            disabled={!connected || state.status !== "waiting"}
            onChange={(event) =>
              action({
                type: "cardsPerParticipant",
                value: Number(event.target.value),
              })
            }
          >
            {Array.from(
              { length: MAX_CARDS_PER_PARTICIPANT },
              (_, index) => index + 1,
            ).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <p className="small-help">
            Com poucas pessoas, aumente para cobrir a linha toda. Você também
            recebe essa quantidade. Só muda antes de iniciar.
          </p>
        </div>
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
        previews={withLocalPreviews(state, localPreviews)}
      />
      {state && cards.length > 0 && (
        <section className="own-item-panel">
          <div className="section-label">
            {cards.length > 1 ? "Seus cartões" : "Seu cartão"}, diferentes dos
            alunos
          </div>
          <OwnCards
            cards={cards}
            placedIds={state.ownPlacedIds ?? []}
            boardRef={boardRef}
            version={state.version}
            disabled={!connected || state.status !== "active"}
            onLocalPreview={setLocalPreview}
            onPreview={preview}
            onDrop={async (itemId, x, version) => {
              try {
                await confirm(itemId, x, version);
                setMessage(placedMessage(isSharedCard(state, itemId), true));
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setLocalPreview(itemId, null);
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
