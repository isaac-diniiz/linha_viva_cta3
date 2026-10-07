import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "../components/Board";
import {
  acceptPreview,
  cancelPreview,
  expirePreviews,
  type Preview,
  type PreviewState,
} from "../domain/preview";
import { supabase } from "../lib/supabase";

export function useProjectionPreviews(
  sessionId: string | null,
  items: Item[],
  version: number,
  status: string,
  client: SupabaseClient = supabase,
) {
  const [previews, setPreviews] = useState<PreviewState>({});
  const versionRef = useRef(version);
  const statusRef = useRef(status);
  const itemIds = items.map((item) => item.id).join(",");

  useEffect(() => {
    versionRef.current = version;
    statusRef.current = status;
    setPreviews({});
  }, [version, status]);

  useEffect(() => {
    if (!sessionId || !itemIds) return;
    const channels = itemIds.split(",").map((itemId) =>
      client
        .channel(`drag:${sessionId}:${itemId}`, { config: { private: true } })
        .on("broadcast", { event: "move" }, ({ payload }) => {
          if (statusRef.current !== "active") return;
          const preview = payload as Preview;
          setPreviews((current) =>
            acceptPreview(
              current,
              itemId,
              { ...preview, receivedAt: Date.now() },
              versionRef.current,
            ),
          );
        })
        .on("broadcast", { event: "cancel" }, ({ payload }) => {
          const preview = payload as Preview;
          setPreviews((current) =>
            cancelPreview(current, itemId, {
              ...preview,
              receivedAt: Date.now(),
            }),
          );
        })
        .subscribe(),
    );
    const timer = window.setInterval(
      () => setPreviews((current) => expirePreviews(current, Date.now(), 2000)),
      250,
    );
    return () => {
      window.clearInterval(timer);
      channels.forEach((channel) => {
        void client.removeChannel(channel);
      });
    };
  }, [sessionId, itemIds, client]);

  return previews;
}
