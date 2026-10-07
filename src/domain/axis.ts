export type Point = { x: number; y: number };
export type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clampPoint(point: Point): Point {
  return { x: clamp(point.x), y: clamp(point.y) };
}

export function normalizedPoint(
  clientX: number,
  clientY: number,
  bounds: Bounds,
): Point {
  return clampPoint({
    x: bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0,
    y: bounds.height > 0 ? (clientY - bounds.top) / bounds.height : 0,
  });
}

export function insertAtX(ids: string[], itemId: string, x: number): string[] {
  const without = ids.filter((id) => id !== itemId);
  const index = Math.min(
    without.length,
    Math.floor(clamp(x) * (without.length + 1)),
  );
  without.splice(index, 0, itemId);
  return without;
}
