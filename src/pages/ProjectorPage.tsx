import { useEffect, useState } from "react";
import { Board } from "../components/Board";
import { LiveOverview } from "../components/LiveOverview";
import { useProjectionPreviews } from "../hooks/useProjectionPreviews";
import { useSession } from "../hooks/useSession";
import { getReference, type Reference } from "../lib/api";
import { projectionSupabase } from "../lib/supabase";

export function ProjectorPage({ sessionId }: { sessionId: string }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState("");
  const [reference, setReference] = useState<Reference[]>([]);
  const { session, activity, items, loading, error } = useSession(
    authorized ? sessionId : null,
    projectionSupabase,
  );
  const previews = useProjectionPreviews(
    authorized ? sessionId : null,
    items,
    session?.version ?? 0,
    session?.status ?? "",
    projectionSupabase,
  );

  useEffect(() => {
    let alive = true;
    const enter = async () => {
      try {
        const key = new URLSearchParams(location.search).get("key");
        if (!key) throw new Error("Abra a projeção pelo painel do professor.");
        const {
          data: { user },
        } = await projectionSupabase.auth.getUser();
        if (!user || !user.is_anonymous) {
          const { error } = await projectionSupabase.auth.signInAnonymously();
          if (error) throw error;
        }
        const { error } = await projectionSupabase.rpc("join_projection", {
          p_session_id: sessionId,
          p_secret: key,
        });
        if (error) throw error;
        if (alive) setAuthorized(true);
      } catch (error) {
        if (alive) {
          setAccessError((error as Error).message);
          setAuthorized(false);
        }
      }
    };
    void enter();
    return () => {
      alive = false;
    };
  }, [sessionId]);
  useEffect(() => {
    if (session?.revealed)
      void getReference(sessionId, projectionSupabase)
        .then(setReference)
        .catch(() => {});
  }, [session?.revealed, sessionId]);

  if (authorized === null || loading || (authorized && !session && !error))
    return <div className="loading">Preparando a projeção…</div>;
  if (!authorized)
    return (
      <main className="app-shell">
        <div className="notice error">
          {accessError || "Abra a projeção pelo painel do professor."}{" "}
          <a href="/professor">Acessar painel</a>
        </div>
      </main>
    );
  if (error || !session)
    return (
      <main className="app-shell">
        <div className="notice error">{error || "Sessão indisponível"}</div>
      </main>
    );

  return (
    <main className="projector-shell">
      <header className="projector-header">
        <div className="logo">
          <span className="logo-mark">L</span>
          <span>Linha Viva</span>
        </div>
        <div className="projector-code">
          ENTRE COM O CÓDIGO <strong>{session.code}</strong>
        </div>
      </header>
      <div className="projector-heading">
        <div>
          <h1>{activity?.title}</h1>
          <p>{activity?.instruction}</p>
        </div>
      </div>
      {items.length > 8 && <LiveOverview items={items} previews={previews} />}
      <Board
        className="projector-board"
        items={items}
        order={session.confirmed_order}
        previews={items.length > 8 ? {} : previews}
      />
      <footer className="projector-footer">
        <span>
          {session.status === "waiting"
            ? "Aguardando o professor iniciar os movimentos."
            : session.status === "active"
              ? "As caixas se movem junto com a turma."
              : session.status === "paused"
                ? "Movimentos pausados pelo professor."
                : "Atividade encerrada."}
        </span>
      </footer>
      {session.revealed && (
        <div className="projector-reference">
          <div className="eyebrow">ORDEM DE REFERÊNCIA</div>
          <div className="reference-list">
            {reference.map((entry) => (
              <span key={entry.item_id}>
                <b>{String(entry.ordinal).padStart(2, "0")}</b>
                {items.find((item) => item.id === entry.item_id)?.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
