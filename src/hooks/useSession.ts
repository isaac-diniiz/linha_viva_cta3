import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchActivity,
  fetchItems,
  fetchSession,
  type Activity,
  type Session,
} from "../lib/api";
import type { Item } from "../components/Board";
import { latestSession } from "../domain/session";
import { supabase } from "../lib/supabase";

export function useSession(
  sessionId: string | null,
  client: SupabaseClient = supabase,
) {
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    const refresh = async () => {
      try {
        const next = await fetchSession(sessionId, client);
        const [nextActivity, nextItems] = await Promise.all([
          fetchActivity(next.activity_id, client),
          fetchItems(next.activity_id, client),
        ]);
        if (alive) {
          setSession((current) => latestSession(current, next));
          setActivity(nextActivity);
          setItems(nextItems);
          setError("");
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void refresh();
    const channel = client
      .channel(`session-state:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        ({ new: row }) => {
          if (alive)
            setSession((current) => latestSession(current, row as Session));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      void client.removeChannel(channel);
    };
  }, [sessionId, client]);

  const refresh = useCallback(async () => {
    if (sessionId) {
      const next = await fetchSession(sessionId, client);
      setSession((current) => latestSession(current, next));
    }
  }, [sessionId, client]);

  return { session, activity, items, error, loading, refresh };
}
