import { useRef, useState } from "react";
import { TrackBoard } from "../../components/TrackBoard";
import { LineCreator } from "../../components/LineCreator";
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
  ReferencePanel,
  replacePreview,
  snapToTrack,
  StatusBadge,
  withLocalPreviews,
} from "../shared";

/** Resposta do servidor quando a sessão do professor falta ou venceu. */
const SESSION_LOST = "Entre como professor.";

export function Teacher({
  account = null,
  onSignOut,
}: {
  /** E-mail do professor conectado; null no modo local, sem login. */
  account?: string | null;
  onSignOut?: () => void;
} = {}) {
  const { state, connected, error, send, confirm, preview } =
    useLocalDemo("teacher");
  // sucesso em verde (status), erro em vermelho (alerta)
  const [message, setMessage] = useState<{
    text: string;
    tone: "ok" | "error";
  } | null>(null);
  // Encerrar e Nova rodada apagam a aula: pedem confirmação antes
  const [confirming, setConfirming] = useState<"end" | "reset" | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, Preview>>(
    {},
  );
  // formulário aberto: linha nova (sem editId) ou edição de uma linha criada
  const [lineForm, setLineForm] = useState<{ editId?: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cards = ownCards(state);
  const waiting = state?.status === "waiting";
  const customLines = state?.customLines ?? [];
  const editedLine = lineForm?.editId
    ? customLines.find((line) => line.id === lineForm.editId)
    : undefined;
  const setLocalPreview = (itemId: string, preview: Preview | null) =>
    setLocalPreviews((current) => replacePreview(current, itemId, preview));
  const action = (payload: unknown) => {
    try {
      send(payload);
      setMessage(null);
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: "error" });
    }
  };
  return (
    <main className="app-shell demo-shell">
      <Header role="PROFESSOR" />
      {account && (
        <div className="account-bar">
          <span>Conectado como {account}</span>
          {onSignOut && (
            <button type="button" className="button subtle" onClick={onSignOut}>
              Sair
            </button>
          )}
        </div>
      )}
      <Connection connected={connected} error={error} />
      {error === SESSION_LOST && onSignOut && (
        <button type="button" className="button primary" onClick={onSignOut}>
          Entrar de novo
        </button>
      )}
      <section className="demo-heading">
        <div>
          <div className="eyebrow">
            CÓDIGO DA TURMA · {state?.code ?? "DEMO1234"}
          </div>
          <h1>{state?.title ?? "Preparando atividade…"}</h1>
        </div>
        {state && <StatusBadge status={state.status} />}
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
      <details
        // reabre sozinho ao voltar a aguardar; depois de iniciar começa recolhido
        key={waiting ? "preparando" : "em-aula"}
        className="teacher-setup"
        open={waiting}
      >
        <summary>Preparação da atividade</summary>
        {state?.themes && (
          <ThemePicker
            themes={state.themes}
            selectedId={state.themeId}
            disabled={!connected || state.status !== "waiting"}
            onChoose={(themeId) => action({ type: "theme", themeId })}
          />
        )}
        {state?.themes && (
          <div className="line-creator-bar">
            <button
              type="button"
              className="button secondary"
              aria-expanded={waiting && lineForm !== null && !lineForm.editId}
              disabled={!connected || !waiting}
              onClick={() => setLineForm({})}
            >
              Criar linha
            </button>
            <span className="small-help">
              {waiting
                ? "Monte uma linha com o seu tema, as pontas e os cartões."
                : "Só dá para criar uma linha antes de iniciar. Use Nova rodada para criar outra."}
            </span>
          </div>
        )}
        {state?.themes && customLines.length > 0 && (
          <section className="custom-lines">
            <div className="section-label">Suas linhas criadas</div>
            <ul>
              {customLines.map((line) => (
                <li key={line.id}>
                  <span className="custom-line-title">{line.titulo}</span>
                  <span className="small-help">
                    {line.cartoes.length} cartões · {line.inicio} → {line.fim}
                  </span>
                  {confirmDeleteId === line.id ? (
                    <span className="custom-line-actions">
                      <span className="small-help">
                        Apagar esta linha? Isso não pode ser desfeito.
                      </span>
                      <button
                        type="button"
                        className="button danger"
                        disabled={!connected || !waiting}
                        onClick={() => {
                          setConfirmDeleteId(null);
                          if (lineForm?.editId === line.id) setLineForm(null);
                          action({ type: "deleteTheme", id: line.id });
                        }}
                      >
                        Sim, apagar
                      </button>
                      <button
                        type="button"
                        className="button subtle"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Não apagar
                      </button>
                    </span>
                  ) : (
                    <span className="custom-line-actions">
                      <button
                        type="button"
                        className="button secondary"
                        aria-label={`Editar ${line.titulo}`}
                        disabled={!connected || !waiting}
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setLineForm({ editId: line.id });
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button subtle"
                        aria-label={`Apagar ${line.titulo}`}
                        disabled={!connected || !waiting}
                        onClick={() => setConfirmDeleteId(line.id)}
                      >
                        Apagar
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!waiting && (
              <p className="small-help">
                Só dá para editar ou apagar uma linha antes de iniciar.
              </p>
            )}
          </section>
        )}
        {state?.themes &&
          waiting &&
          lineForm &&
          (!lineForm.editId || editedLine) && (
            <LineCreator
              key={lineForm.editId ?? "nova"}
              storage={state.linesStorage}
              savedKey={
                lineForm.editId
                  ? JSON.stringify(editedLine)
                  : state.themes.length
              }
              editing={editedLine && { id: editedLine.id, form: editedLine }}
              onSubmit={(line) =>
                action(
                  lineForm.editId
                    ? { type: "updateTheme", id: lineForm.editId, line }
                    : { type: "createTheme", line },
                )
              }
              onClose={() => setLineForm(null)}
            />
          )}
        {state && (
          <div className="cards-per-participant">
            <label className="teacher-plays">
              <input
                type="checkbox"
                checked={state.teacherPlays}
                disabled={!connected || state.status !== "waiting"}
                onChange={(event) =>
                  action({ type: "teacherPlays", value: event.target.checked })
                }
              />
              Participar com cartões
            </label>
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
              Com poucas pessoas, aumente para cobrir a linha toda.{" "}
              {state.teacherPlays
                ? "Você também recebe essa quantidade."
                : "Você só conduz: todos os cartões vão para os alunos."}{" "}
              Só muda antes de iniciar.
            </p>
          </div>
        )}
      </details>
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
          onClick={() => setConfirming("end")}
        >
          Encerrar
        </button>
        <button
          className="button secondary"
          disabled={!connected}
          onClick={() => setConfirming("reset")}
        >
          Nova rodada
        </button>
      </div>
      {confirming === "end" && (
        <div
          className="confirm-bar"
          role="group"
          aria-label="Confirmar encerramento"
        >
          <span>
            Encerrar a atividade? Os alunos não poderão mais mover os cartões.
          </span>
          <button
            type="button"
            className="button danger"
            disabled={!connected}
            onClick={() => {
              setConfirming(null);
              action({ type: "status", status: "ended" });
            }}
          >
            Sim, encerrar
          </button>
          <button
            type="button"
            className="button subtle"
            onClick={() => setConfirming(null)}
          >
            Continuar a aula
          </button>
        </div>
      )}
      {confirming === "reset" && (
        <div
          className="confirm-bar"
          role="group"
          aria-label="Confirmar nova rodada"
        >
          <span>
            Começar uma nova rodada? A linha atual será apagada e todos recebem
            cartões novos.{" "}
            {state?.status === "ended"
              ? "Como a atividade foi encerrada, a turma recebe um código novo: confira na projeção."
              : "O código da turma continua o mesmo."}
          </span>
          <button
            type="button"
            className="button danger"
            disabled={!connected}
            onClick={() => {
              setConfirming(null);
              action({ type: "reset" });
            }}
          >
            Sim, nova rodada
          </button>
          <button
            type="button"
            className="button subtle"
            onClick={() => setConfirming(null)}
          >
            Cancelar
          </button>
        </div>
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
      {/* acima da trilha, para não ficar escondida embaixo da página */}
      {state?.revealed && state.reference && (
        <ReferencePanel labels={state.reference} />
      )}
      <TrackBoard
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
                await confirm(itemId, snapToTrack(state, itemId, x), version);
                setMessage({
                  text: placedMessage(isSharedCard(state, itemId), true),
                  tone: "ok",
                });
              } catch (error) {
                setMessage({ text: (error as Error).message, tone: "error" });
              } finally {
                setLocalPreview(itemId, null);
              }
            }}
          />
        </section>
      )}
    </main>
  );
}
