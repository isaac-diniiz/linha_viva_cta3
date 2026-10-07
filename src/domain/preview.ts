import { clampPoint } from "./axis";

export type Preview = {
  dragId: string;
  seq: number;
  x: number;
  y: number;
  version: number;
  sentAt: number;
  receivedAt?: number;
  startedAt?: number;
  cancelled?: boolean;
};
export type PreviewState = Record<string, Preview>;

export function acceptPreview(
  state: PreviewState,
  itemId: string,
  incoming: Preview,
  confirmedVersion: number,
): PreviewState {
  if (incoming.version !== confirmedVersion) return state;
  const old = state[itemId];
  if (old?.dragId === incoming.dragId && old.cancelled) return state;
  if (old && old.dragId === incoming.dragId && incoming.seq <= old.seq)
    return state;
  if (
    old &&
    old.dragId !== incoming.dragId &&
    old.startedAt !== undefined &&
    incoming.startedAt !== undefined &&
    incoming.startedAt < old.startedAt
  )
    return state;
  const point = clampPoint(incoming);
  return { ...state, [itemId]: { ...incoming, ...point, cancelled: false } };
}

export function cancelPreview(
  state: PreviewState,
  itemId: string,
  incoming: Preview,
): PreviewState {
  const old = state[itemId];
  if (old && old.dragId !== incoming.dragId) return state;
  return { ...state, [itemId]: { ...incoming, cancelled: true } };
}

export function expirePreviews(
  state: PreviewState,
  now: number,
  ttlMs: number,
): PreviewState {
  return Object.fromEntries(
    Object.entries(state).filter(
      ([, preview]) => now - (preview.receivedAt ?? preview.sentAt) < ttlMs,
    ),
  );
}
