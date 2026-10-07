import { useEffect, useState, type FormEvent } from "react";
import { Board } from "../components/Board";
import { useSession } from "../hooks/useSession";
import {
  createActivity,
  createSession,
  deleteSession,
  fetchMemberCount,
  getProjectionKey,
  getReference,
  revealReference,
  setStatus,
  type Reference,
} from "../lib/api";
import { configured, supabase } from "../lib/supabase";

export function TeacherPage() {
  const [teacher, setTeacher] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [sessionId, setSessionId] = useState(
    new URLSearchParams(location.search).get("session"),
  );
  const [title, setTitle] = useState("Ciclo da água");
  const [instruction, setInstruction] = useState(
    "Organize as etapas do ciclo da água na sequência correta.",
  );
  const [labels, setLabels] = useState("Evaporação\nCondensação\nPrecipitação");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [reference, setReference] = useState<Reference[]>([]);
  const [projectionKey, setProjectionKey] = useState("");
  const { session, activity, items, loading, error, refresh } = useSession(
    teacher ? sessionId : null,
  );

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setTeacher(Boolean(data.user && !data.user.is_anonymous));
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (!sessionId || !teacher) return;
    const update = () =>
      void fetchMemberCount(sessionId)
        .then(setMemberCount)
        .catch(() => {});
    update();
    const channel = supabase
      .channel(`members:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_members",
          filter: `session_id=eq.${sessionId}`,
        },
        update,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, teacher]);

  useEffect(() => {
    if (session?.revealed)
      void getReference(session.id)
        .then(setReference)
        .catch(() => {});
  }, [session?.id, session?.revealed]);

  useEffect(() => {
    setProjectionKey("");
    if (sessionId && teacher)
      void getProjectionKey(sessionId)
        .then(setProjectionKey)
        .catch((error) => setMessage((error as Error).message));
  }, [sessionId, teacher]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${location.origin}/professor`,
        },
      });
      if (authError) throw authError;
      setSent(true);
      setMessage(
        "Confira seu e-mail. Digite o código recebido ou abra o link de acesso.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (authError) throw authError;
      setTeacher(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function makeSession(event: FormEvent) {
    event.preventDefault();
    const list = labels
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length < 3 || list.length > 40) {
      setMessage("Inclua entre 3 e 40 itens, um por linha.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const activityId = await createActivity(title, instruction, list);
      const id = await createSession(activityId);
      history.replaceState({}, "", `/professor?session=${id}`);
      setSessionId(id);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function action(operation: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <a href="/" className="logo">
          <span className="logo-mark">L</span>
          <span>Linha Viva</span>
        </a>
        <span className="header-tag">PAINEL DO PROFESSOR</span>
      </header>
      {!configured && (
        <div className="notice error">
          Conecte o Supabase em <code>.env.local</code> para criar sessões.
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {checking ? (
        <div className="loading">Verificando acesso…</div>
      ) : !teacher ? (
        <section className="panel narrow-panel">
          <div className="eyebrow">ACESSO DO PROFESSOR</div>
          <h1>Vamos preparar a turma.</h1>
          <p>Entre com o e-mail autorizado para conduzir uma atividade.</p>
          {!sent ? (
            <form
              onSubmit={(event) => {
                void requestCode(event);
              }}
            >
              <label>
                E-mail
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="professor@escola.edu.br"
                />
              </label>
              <button className="button primary" disabled={busy || !configured}>
                Enviar código →
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                void verifyCode(event);
              }}
            >
              <label>
                Código recebido
                <input
                  required
                  inputMode="numeric"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="000000"
                />
              </label>
              <button className="button primary" disabled={busy}>
                Entrar →
              </button>
              <p>
                Se o e-mail trouxer apenas um link, você também pode abri-lo
                neste navegador.
              </p>
            </form>
          )}
        </section>
      ) : !sessionId ? (
        <section className="panel editor-panel">
          <div className="eyebrow">NOVA ATIVIDADE</div>
          <h1>Prepare a linha da turma.</h1>
          <p>
            Escreva os itens na ordem de referência. Essa resposta ficará
            reservada até você revelá-la.
          </p>
          <form
            onSubmit={(event) => {
              void makeSession(event);
            }}
            className="editor-form"
          >
            <label>
              Título
              <input
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Instrução para a turma
              <textarea
                required
                maxLength={500}
                rows={2}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </label>
            <label>
              Itens, um por linha, na ordem correta
              <textarea
                required
                rows={8}
                value={labels}
                onChange={(event) => setLabels(event.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy}>
              Criar atividade e abrir sessão →
            </button>
          </form>
        </section>
      ) : loading || !session ? (
        <div className="loading">Carregando sessão…</div>
      ) : (
        <div className="teacher-layout">
          <div className="teacher-main">
            <div className="section-heading">
              <div>
                <h1>{activity?.title ?? "Atividade"}</h1>
                <p>{activity?.instruction}</p>
              </div>
              <span className={`status-pill ${session.status}`}>
                {session.status === "waiting"
                  ? "Aguardando"
                  : session.status === "active"
                    ? "● Aberta"
                    : session.status === "paused"
                      ? "Ⅱ Pausada"
                      : "Encerrada"}
              </span>
            </div>
            <Board
              items={items}
              order={session.confirmed_order}
              previews={{}}
            />
            <div className="board-note">{memberCount} participantes</div>
            {session.revealed && (
              <section className="reference-panel">
                <div className="eyebrow">ORDEM DE REFERÊNCIA</div>
                <ol>
                  {reference.map((entry) => (
                    <li key={entry.item_id}>
                      {items.find((item) => item.id === entry.item_id)?.label}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
          <aside className="teacher-sidebar">
            <div className="panel session-card">
              <div className="eyebrow">CÓDIGO DA TURMA</div>
              <div className="session-code">{session.code}</div>
              <a className="text-link" href={`/entrar/${session.code}`}>
                Abrir entrada do aluno ↗
              </a>
            </div>
            <div className="panel controls-card">
              <div className="eyebrow">CONTROLE DA ATIVIDADE</div>
              {projectionKey ? (
                <a
                  className="button secondary full"
                  href={`/projetor/${session.id}?key=${encodeURIComponent(projectionKey)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir projeção ↗
                </a>
              ) : (
                <span className="button secondary full">
                  Preparando projeção…
                </span>
              )}
              {session.status !== "ended" && (
                <>
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() => {
                      void action(() =>
                        setStatus(
                          session.id,
                          session.status === "active" ? "paused" : "active",
                        ),
                      );
                    }}
                  >
                    {session.status === "waiting"
                      ? "Iniciar movimentos"
                      : session.status === "active"
                        ? "Pausar movimentos"
                        : "Retomar movimentos"}
                  </button>
                  {!session.revealed && (
                    <button
                      className="button secondary full"
                      disabled={busy}
                      onClick={() => {
                        void action(() => revealReference(session.id));
                      }}
                    >
                      Revelar resposta
                    </button>
                  )}
                  <button
                    className="button subtle full"
                    disabled={busy}
                    onClick={() => {
                      void action(() => setStatus(session.id, "ended"));
                    }}
                  >
                    Encerrar sessão
                  </button>
                </>
              )}
              {session.status === "ended" && !session.revealed && (
                <button
                  className="button secondary full"
                  disabled={busy}
                  onClick={() => {
                    void action(() => revealReference(session.id));
                  }}
                >
                  Revelar resposta
                </button>
              )}
              <button
                className="button danger full"
                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await deleteSession(session.id);
                    history.replaceState({}, "", "/professor");
                    setSessionId(null);
                  });
                }}
              >
                Apagar dados desta sessão
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
