import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Item } from "../components/Board";

export type Session = {
  id: string;
  activity_id: string;
  teacher_id: string;
  code: string;
  status: "waiting" | "active" | "paused" | "ended";
  version: number;
  confirmed_order: string[];
  revealed: boolean;
  expires_at: string;
};
export type Activity = { id: string; title: string; instruction: string };
export type Reference = { item_id: string; ordinal: number };

function unwrap<T>(response: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (response.error) throw new Error(response.error.message);
  if (response.data === null) throw new Error("Resposta vazia do servidor");
  return response.data;
}

export async function fetchSession(
  id: string,
  client: SupabaseClient = supabase,
): Promise<Session> {
  return unwrap(
    await client.from("sessions").select("*").eq("id", id).single(),
  ) as Session;
}

export async function fetchActivity(
  id: string,
  client: SupabaseClient = supabase,
): Promise<Activity> {
  return unwrap(
    await client
      .from("activities")
      .select("id,title,instruction")
      .eq("id", id)
      .single(),
  ) as Activity;
}

export async function fetchItems(
  activityId: string,
  client: SupabaseClient = supabase,
): Promise<Item[]> {
  return unwrap(
    await client
      .from("activity_items")
      .select("id,label")
      .eq("activity_id", activityId)
      .order("id"),
  ) as Item[];
}

export async function fetchMember(
  sessionId: string,
  userId: string,
): Promise<{ item_id: string } | null> {
  const { data, error } = await supabase
    .from("session_members")
    .select("item_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMemberCount(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("session_members")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createActivity(
  title: string,
  instruction: string,
  labels: string[],
): Promise<string> {
  return unwrap(
    await supabase.rpc("create_activity", {
      p_title: title,
      p_instruction: instruction,
      p_labels: labels,
    }),
  ) as string;
}

export async function createSession(activityId: string): Promise<string> {
  return unwrap(
    await supabase.rpc("create_session", { p_activity_id: activityId }),
  ) as string;
}

export async function getProjectionKey(sessionId: string): Promise<string> {
  return unwrap(
    await supabase.rpc("get_projection_key", { p_session_id: sessionId }),
  ) as string;
}

export async function joinSession(
  code: string,
): Promise<{ session_id: string; item_id: string }> {
  const rows = unwrap(await supabase.rpc("join_session", { p_code: code })) as {
    session_id: string;
    item_id: string;
  }[];
  if (!rows[0]) throw new Error("Não foi possível entrar na sessão");
  return rows[0];
}

export async function placeItem(
  sessionId: string,
  x: number,
  version: number,
): Promise<number> {
  return unwrap(
    await supabase.rpc("place_item", {
      p_session_id: sessionId,
      p_x: x,
      p_expected_version: version,
    }),
  ) as number;
}

export async function setStatus(
  sessionId: string,
  status: Session["status"],
): Promise<void> {
  const { error } = await supabase.rpc("set_session_status", {
    p_session_id: sessionId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function revealReference(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("reveal_reference", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
}

export async function getReference(
  sessionId: string,
  client: SupabaseClient = supabase,
): Promise<Reference[]> {
  return unwrap(
    await client.rpc("get_reference", { p_session_id: sessionId }),
  ) as Reference[];
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_session", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
}
