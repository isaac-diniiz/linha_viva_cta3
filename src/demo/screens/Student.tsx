import { useEffect, useRef, useState } from "react";
import { Board } from "../../components/Board";
import type { Preview } from "../../domain/preview";
import { useLocalDemo } from "../client";
import { INVALID_CODE_MESSAGE } from "../domain";
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
import { JoinCode } from "./JoinCode";

export function Student({ code }: { code: string }) {
  const { state, connected, error, confirm, preview } = useLocalDemo(
    "student",
    code,
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, Preview>>(
    {},
  );
  const [chosenId, setChosenId] = useState("");
  const [sliderX, setSliderX] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setLocalPreviews({});
  }, [state?.status, connected]);
  const cards = ownCards(state);
  const target = cards.find((card) => card.id === chosenId) ?? cards[0];
  const anyShared = cards.some((card) => isSharedCard(state, card.id));
  const disabled = !connected || !state || state.status !== "active" || busy;
  const setLocalPreview = (itemId: string, preview: Preview | null) =>
    setLocalPreviews((current) => replacePreview(current, itemId, preview));
  const place = async (
    itemId: string,
    x: number,
    version = state?.version ?? -1,
  ) => {
    setBusy(true);
    setMessage("");
    try {
      await confirm(itemId, x, version);
      setMessage(placedMessage(isSharedCard(state, itemId)));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      setLocalPreview(itemId, null);
    }
  };
  const previews = withLocalPreviews(state, localPreviews);
  // código errado ou de uma sessão antiga: pede o código de novo
  if (!state && error === INVALID_CODE_MESSAGE)
    return <JoinCode error={error} />;
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
          <div
            className={`section-label${cards.length > 1 ? " is-visible" : ""}`}
          >
            {cards.length > 1 ? `Seus cartões (${cards.length})` : "Seu item"}
          </div>
          {anyShared && (
            <p className="small-help" data-testid="shared-card-hint">
              {cards.length > 1
                ? "Colegas têm cartões iguais a alguns dos seus."
                : "Mais colegas têm este mesmo cartão."}{" "}
              Cada um vota onde ele deve ficar; a caixa da linha fica no meio
              das escolhas do grupo. Conversem e ajustem seu voto até chegarem a
              um acordo.
            </p>
          )}
          <div className="own-item-panel">
            {cards.length ? (
              <OwnCards
                cards={cards}
                placedIds={state?.ownPlacedIds ?? []}
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
            {cards.length > 1 && (
              <>
                <label htmlFor="demo-position-card">
                  Cartão para posicionar
                </label>
                <select
                  id="demo-position-card"
                  value={target?.id ?? ""}
                  disabled={disabled}
                  onChange={(event) => setChosenId(event.target.value)}
                >
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.label}
                    </option>
                  ))}
                </select>
              </>
            )}
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
              disabled={disabled || !target}
              onClick={() => target && void place(target.id, sliderX / 100)}
            >
              Confirmar posição escolhida
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
