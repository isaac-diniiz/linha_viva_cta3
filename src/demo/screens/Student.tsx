import { useEffect, useRef, useState } from "react";
import { TrackBoard } from "../../components/TrackBoard";
import type { Preview } from "../../domain/preview";
import { slotCenter } from "../../domain/track";
import { useLocalDemo } from "../client";
import { INVALID_CODE_MESSAGE } from "../domain";
import {
  boardData,
  Connection,
  Header,
  isSharedCard,
  OwnCards,
  ownCards,
  ownResults,
  placedMessage,
  replacePreview,
  snapToTrack,
  trackSlots,
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
  const [chosenSlot, setChosenSlot] = useState(1);
  const [busy, setBusy] = useState(false);
  // resultado da última jogada: sucesso em verde, erro como alerta
  const [message, setMessage] = useState<{
    text: string;
    tone: "ok" | "error";
  } | null>(null);
  useEffect(() => {
    setLocalPreviews({});
  }, [state?.status, connected]);
  // mensagem velha não sobrevive a pausa, encerramento ou nova rodada
  useEffect(() => {
    setMessage(null);
  }, [state?.status]);
  const lastVersion = useRef(state?.version ?? 0);
  useEffect(() => {
    const version = state?.version ?? 0;
    if (version < lastVersion.current) setMessage(null);
    lastVersion.current = version;
  }, [state?.version]);
  const cards = ownCards(state);
  const target = cards.find((card) => card.id === chosenId) ?? cards[0];
  const anyShared = cards.some((card) => isSharedCard(state, card.id));
  const slots = trackSlots(state);
  const slotNumber = Math.min(chosenSlot, slots);
  const disabled = !connected || !state || state.status !== "active" || busy;
  const setLocalPreview = (itemId: string, preview: Preview | null) =>
    setLocalPreviews((current) => replacePreview(current, itemId, preview));
  const place = async (
    itemId: string,
    x: number,
    version = state?.version ?? -1,
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      // o cartão encaixa numa casa da trilha; numa casa ocupada, entra antes
      await confirm(itemId, snapToTrack(state, itemId, x), version);
      setMessage({
        text: placedMessage(isSharedCard(state, itemId)),
        tone: "ok",
      });
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: "error" });
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
        <section className="closing-panel" aria-label="Fechamento">
          <h2>Atividade encerrada</h2>
          <p>
            Obrigado por participar! A linha final da turma está abaixo. Agora é
            hora de conversar sobre ela com o professor.
          </p>
        </section>
      )}
      {/* a resposta fica na projeção, para a conversa ser com a turma toda */}
      {state?.revealed && (
        <div className="notice" role="status">
          A resposta foi revelada. Olhe a projeção para conversar com a turma.
        </div>
      )}
      {/* só os próprios cartões, no próprio celular: nada disso vai para a projeção */}
      {ownResults(state).length > 0 && (
        <section className="own-result" aria-label="Seu cartão na resposta">
          <ul>
            {ownResults(state).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {message &&
        (message.tone === "error" ? (
          <div className="notice error" role="alert">
            {message.text}
          </div>
        ) : (
          <div className="notice" role="status">
            {message.text}
          </div>
        ))}
      <div className="student-layout">
        <section className="student-board-section">
          <div className="section-label">Linha da turma</div>
          <TrackBoard
            ref={boardRef}
            smoothPreviews={false}
            {...boardData(state)}
            // a comparação de todos os cartões fica na projeção, para a conversa da turma
            answer={undefined}
            previews={previews}
          />
        </section>
        <aside className="student-side">
          <div
            className={`section-label${cards.length > 1 ? " is-visible" : ""}`}
          >
            {cards.length > 1 ? `Seus cartões (${cards.length})` : "Seu item"}
          </div>
          {anyShared && state?.status !== "ended" && (
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
          {state?.status !== "ended" && (
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
                Outra forma de posicionar: escolha a casa
              </label>
              <input
                id="demo-position-range"
                type="range"
                min="1"
                max={slots}
                step="1"
                value={slotNumber}
                aria-valuetext={`Casa ${slotNumber} de ${slots}`}
                disabled={disabled}
                onChange={(event) => setChosenSlot(Number(event.target.value))}
              />
              <div className="slot-choice" aria-hidden="true">
                Casa {slotNumber} de {slots}
              </div>
              <div className="range-labels">
                <span>{state?.axis.start ?? "Início"}</span>
                <span>{state?.axis.end ?? "Fim"}</span>
              </div>
              <button
                className="button secondary full"
                disabled={disabled || !target}
                onClick={() =>
                  target &&
                  void place(target.id, slotCenter(slotNumber - 1, slots))
                }
              >
                Confirmar posição escolhida
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
