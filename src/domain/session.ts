export function latestSession<T extends { id: string; version: number }>(
  current: T | null,
  incoming: T,
): T {
  if (current?.id === incoming.id && current.version > incoming.version)
    return current;
  return incoming;
}
