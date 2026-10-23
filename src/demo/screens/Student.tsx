import { useEffect, useRef, useState } from "react";
import { Board } from "../../components/Board";
import { DragCard } from "../../components/DragCard";
import type { Preview } from "../../domain/preview";
import { useLocalDemo } from "../client";
import { boardData, Connection, Header, isSharedCard } from "../shared";

export function Student({ code }: { code: string }) {
  const { state, connected, error, confirm, preview } = useLocalDemo(
    "student",
    code,
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const [localPreview, setLocalPreview] = useState<Preview | null>(null);
  const [sliderX, setSliderX] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setLocalPreview(null);
  }, [state?.status, connected]);
  const ownItem = state?.items.find((item) => item.id === state.ownItemId);
  const sharedCard = isSharedCard(state);
  const disabled = !connected || !state || state.status !== "active" || busy;
  const place = async (x: number, version = state?.version ?? -1) => {
    setBusy(true);
    setMessage("");
    try {
      await confirm(x, version);
      setMessage(
        sharedCard
          ? "Seu voto foi registrado. A caixa fica no consenso de quem tem o mesmo cartão."
          : "Sua caixa foi colocada na linha coletiva.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      setLocalPreview(null);
    }
  };
  const previews =
    localPreview && ownItem
      ? { ...state?.previews, [ownItem.id]: localPreview }
      : (state?.previews ?? {});
  return (
    <main className="app-shell student-shell demo-shell">
      <Header role="ALUNO" />
      <Connection connected={connected} error={error} />
      <div className="student-intro">
        <h1>{state?.title ?? "Entrando na turma…"}</h1>
        <p>{state?.instruction}</p>
      </div>
      {state?.status === "waiting" && (
        <div className="notice" role="status">
          Aguarde o professor iniciar a atividade.
        </div>
      )}
      {state?.status === "paused" && (
        <div className="notice" role="status">
          O professor pausou os movimentos.
        </div>
      )}
      {state?.status === "ended" && (
        <div className="notice" role="status">
          A atividade foi encerrada.
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="student-layout">
        <section className="student-board-section">
          <div className="section-label">Linha da turma</div>
          <Board
            ref={boardRef}
            smoothPreviews={false}
            {...boardData(state)}
            previews={previews}
          />
        </section>
        <aside className="student-side">
          <div className="section-label">Seu item</div>
          {sharedCard && (
            <p className="small-help" data-testid="shared-card-hint">
              Mais colegas têm este mesmo cartão. Cada um vota onde ele deve
              ficar; a caixa da linha fica no meio das escolhas do grupo.
              Conversem e ajustem seu voto até chegarem a um acordo.
            </p>
          )}
          <div className="own-item-panel">
            {ownItem ? (
              <DragCard
                label={ownItem.label}
                boardRef={boardRef}
                version={state?.version ?? 0}
                disabled={disabled}
                onLocalPreview={setLocalPreview}
                onPreview={preview}
                onDrop={place}
              />
            ) : (
              <div className="loading">{error || "Aguardando um item…"}</div>
            )}
          </div>
          <div className="accessibility-panel">
            <label htmlFor="demo-position-range">
              Outra forma de posicionar: escolha um ponto na linha
            </label>
            <input
              id="demo-position-range"
              type="range"
              min="0"
              max="100"
              value={sliderX}
              disabled={disabled}
              onChange={(event) => setSliderX(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>{state?.axis.start ?? "Início"}</span>
              <span>{state?.axis.end ?? "Fim"}</span>
            </div>
            <button
              className="button secondary full"
              disabled={disabled}
              onClick={() => void place(sliderX / 100)}
            >
              Confirmar posição escolhida
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
