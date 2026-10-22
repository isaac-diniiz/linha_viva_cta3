import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Board } from "../components/Board";
import { DragCard } from "../components/DragCard";
import { ThemePicker } from "../components/ThemePicker";
import type { Preview } from "../domain/preview";
import { useLocalDemo, type DemoSnapshot } from "./client";

function boardData(state: DemoSnapshot | null) {
  const cards = state?.cards ?? [];
  return {
    // as caixas da linha são os cartões; as ocorrências dos alunos só dão nome às prévias
    items: [...cards, ...(state?.items ?? [])],
    order: state?.confirmedOrder ?? [],
    positions: state?.confirmedPositions,
    cardCount: cards.length,
    startLabel: state?.axis.start,
    endLabel: state?.axis.end,
    votes: Object.fromEntries(
      cards.map((card) => [
        card.id,
        { votes: card.votes, total: card.total, marks: card.marks },
      ]),
    ),
  };
}

/** Mais de uma pessoa recebeu o mesmo cartão, então a posição é votada. */
function isSharedCard(state: DemoSnapshot | null): boolean {
  const own = state?.items.find((item) => item.id === state.ownItemId);
  return (
    !!own &&
    (state?.items.filter((item) => item.label === own.label).length ?? 0) > 1
  );
}

function Header({ role }: { role: string }) {
  return (
    <header className="app-header">
      <a className="logo" href="/">
        <span className="logo-mark">L</span>
        <span>Linha Viva</span>
      </a>
      <span className="header-tag">DEMONSTRAÇÃO · {role}</span>
    </header>
  );
}

function Connection({
  connected,
  error,
}: {
  connected: boolean;
  error: string;
}) {
  return (
    <>
      {!connected && (
        <div className="notice error" role="status">
          Reconectando ao computador. Aguarde para continuar.
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}

function Home() {
  return (
    <main className="app-shell demo-shell">
      <Header role="INÍCIO" />
      <section className="panel demo-welcome">
        <div className="demo-welcome-copy">
          <div className="eyebrow">APRENDER É CONSTRUIR JUNTO</div>
          <h1>Uma linha feita por todos.</h1>
          <p>
            Abra o painel do professor e compartilhe o link de entrada com a
            turma.
          </p>
          <div className="demo-links">
            <a className="button primary" href="/demo/professor">
              Professor
            </a>
            <a className="button secondary" href="/demo/projetor">
              Projeção
            </a>
            <a className="button secondary" href="/demo/aluno">
              Aluno
            </a>
          </div>
          <p className="small-help">
            Código de demonstração: <strong>DEMO1234</strong>. Os dados são
            apagados ao parar o servidor local.
          </p>
        </div>
        <img
          className="home-logo-image"
          src="/linha-viva-logo.png"
          alt="Logo da Linha Viva"
        />
      </section>
    </main>
  );
}

function Teacher() {
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

function JoinQr({ code }: { code: string }) {
  const url = `${location.origin}/demo/aluno/${encodeURIComponent(code)}`;
  const [image, setImage] = useState("");

  useEffect(() => {
    let current = true;
    setImage("");
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 3,
      width: 320,
    }).then((data) => {
      if (current) setImage(data);
    });
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <aside className="demo-join-qr">
      <div>
        <div className="section-label">ENTRE NA ATIVIDADE</div>
        <p>Aponte a câmera do celular para o QR Code.</p>
        <strong>Código: {code}</strong>
      </div>
      {image && (
        <img
          src={image}
          alt="QR Code para alunos entrarem"
          data-join-url={url}
          width="240"
          height="240"
        />
      )}
    </aside>
  );
}

function Projection() {
  const { state, connected, error } = useLocalDemo("projection");
  return (
    <main className="app-shell demo-shell">
      <Header role="PROJEÇÃO" />
      <Connection connected={connected} error={error} />
      <section className="demo-heading">
        <div>
          <h1>{state?.title ?? "Aguardando…"}</h1>
          <p>{state?.instruction}</p>
        </div>
        <span className="header-tag">
          {state?.status === "active"
            ? "EM CONSTRUÇÃO"
            : state?.status === "paused"
              ? "PAUSADA"
              : state?.status === "ended"
                ? "ENCERRADA"
                : "AGUARDANDO"}
        </span>
      </section>
      {connected && state?.status === "waiting" && <JoinQr code={state.code} />}
      <Board
        {...boardData(state)}
        previews={state?.previews ?? {}}
        className="demo-projection-board"
      />
      {state?.revealed && (
        <div className="notice" role="status">
          Sequência de referência: {state.reference?.join(" → ")}
        </div>
      )}
    </main>
  );
}

function Student({ code }: { code: string }) {
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

export function DemoApp() {
  const path = window.location.pathname;
  if (path === "/demo/professor") return <Teacher />;
  if (path === "/demo/projetor") return <Projection />;
  if (path === "/demo/aluno" || path.startsWith("/demo/aluno/"))
    return <Student code={path.split("/")[3] || "DEMO1234"} />;
  return <Home />;
}
