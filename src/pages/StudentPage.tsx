import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Board } from "../components/Board";
import { DragCard } from "../components/DragCard";
import { clamp } from "../domain/axis";
import type { Preview } from "../domain/preview";
import { useSession } from "../hooks/useSession";
import { joinSession, placeItem } from "../lib/api";
import { supabase } from "../lib/supabase";

export function StudentPage({ code }: { code: string }) {
  const [membership, setMembership] = useState<{
    session_id: string;
    item_id: string;
  } | null>(null);
  const [joining, setJoining] = useState(true);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState("");
  const [localPreview, setLocalPreview] = useState<Preview | null>(null);
  const [sliderX, setSliderX] = useState(50);
  const [busy, setBusy] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { session, activity, items, error, refresh } = useSession(
    membership?.session_id ?? null,
  );
  const sessionStatus = session?.status;

  useEffect(() => {
    let alive = true;
    const enter = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && !user.is_anonymous)
          throw new Error(
            "Abra a entrada do aluno em uma janela separada da conta do professor.",
          );
        if (!user) {
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) throw authError;
        }
        const joined = await joinSession(code);
        if (alive) setMembership(joined);
      } catch (e) {
        if (alive) setMessage((e as Error).message);
      } finally {
        if (alive) setJoining(false);
      }
    };
    void enter();
    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => {
      setOnline(false);
      setConnected(false);
      setLocalPreview(null);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  useEffect(() => {
    if (!membership || !sessionStatus) return;
    const channel = supabase
      .channel(`drag:${membership.session_id}:${membership.item_id}`, {
        config: { private: true },
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [membership, sessionStatus]);

  useEffect(() => {
    setLocalPreview(null);
  }, [session?.version, session?.status]);

  function sendPreview(preview: Preview, event: "move" | "cancel") {
    if (!online || !connected || !channelRef.current) return;
    void channelRef.current.send({
      type: "broadcast",
      event,
      payload: preview,
    });
  }

  async function confirm(x: number, version = session?.version ?? -1) {
    if (!membership || !session) return;
    setBusy(true);
    setMessage("");
    try {
      await placeItem(membership.session_id, clamp(x), version);
      await refresh();
      setMessage("Sua caixa foi colocada na linha coletiva.");
    } catch (e) {
      await refresh().catch(() => {});
      setMessage(
        `A posição mudou enquanto você movia a caixa. Confira a linha e tente novamente. (${(e as Error).message})`,
      );
    } finally {
      setBusy(false);
      setLocalPreview(null);
    }
  }

  const ownItem = items.find((item) => item.id === membership?.item_id);
  const previews =
    localPreview && ownItem ? { [ownItem.id]: localPreview } : {};
  const disabled =
    !online || !connected || busy || session?.status !== "active";

  return (
    <main className="app-shell student-shell">
      <header className="app-header">
        <a href="/" className="logo">
          <span className="logo-mark">L</span>
          <span>Linha Viva</span>
        </a>
      </header>
      {joining ? (
        <div className="loading">Preparando seu lugar na turma…</div>
      ) : !membership ? (
        <section className="panel narrow-panel">
          <h1>Não foi possível entrar.</h1>
          <p role="alert">{message}</p>
          <a className="button secondary" href="/">
            Voltar ao início
          </a>
        </section>
      ) : (
        <>
          <div className="student-intro">
            <h1>{activity?.title ?? "Linha da turma"}</h1>
            <p>{activity?.instruction}</p>
          </div>
          {(!online || !connected) && (
            <div className="notice error" role="status">
              Conexão indisponível. Aguarde para mover sua caixa; nenhuma
              posição será confirmada enquanto estiver desconectado.
            </div>
          )}
          {session?.status === "waiting" && (
            <div className="notice" role="status">
              Aguarde o professor iniciar os movimentos.
            </div>
          )}
          {session?.status === "paused" && (
            <div className="notice" role="status">
              O professor pausou os movimentos. A linha continua visível.
            </div>
          )}
          {session?.status === "ended" && (
            <div className="notice" role="status">
              A atividade foi encerrada.
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
          <div className="student-layout">
            <section className="student-board-section">
              <div className="section-label">
                <span>Linha da turma</span>
              </div>
              <Board
                ref={boardRef}
                smoothPreviews={false}
                items={items}
                order={session?.confirmed_order ?? []}
                previews={previews}
              />
            </section>
            <aside className="student-side">
              <div className="section-label">Seu item</div>
              <div className="own-item-panel">
                {ownItem ? (
                  <DragCard
                    label={ownItem.label}
                    boardRef={boardRef}
                    version={session?.version ?? 0}
                    disabled={disabled}
                    onLocalPreview={setLocalPreview}
                    onPreview={sendPreview}
                    onDrop={confirm}
                  />
                ) : (
                  <div className="loading">Carregando item…</div>
                )}
              </div>
              <div className="accessibility-panel">
                <label htmlFor="position-range">
                  Outra forma de posicionar: escolha um ponto na linha
                </label>
                <input
                  id="position-range"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={sliderX}
                  disabled={disabled}
                  onChange={(event) => setSliderX(Number(event.target.value))}
                />
                <div className="range-labels">
                  <span>Início</span>
                  <span>Fim</span>
                </div>
                <button
                  className="button secondary full"
                  disabled={disabled}
                  onClick={() => {
                    void confirm(sliderX / 100);
                  }}
                >
                  Confirmar posição escolhida
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
