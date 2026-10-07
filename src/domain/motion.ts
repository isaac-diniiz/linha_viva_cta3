import { clamp, type Point } from "./axis";

export type MotionSample = Point & { sentAt: number };

const MAX_PREDICTION_MS = 180;
const MAX_PREDICTED_DISTANCE = 0.25;
const RESPONSE_MS = 55;

export function predictMotion(
  previous: MotionSample | null,
  latest: MotionSample,
  elapsedMs: number,
): Point {
  const interval = previous ? latest.sentAt - previous.sentAt : 0;
  if (!previous || interval < 20 || interval > 1000)
    return { x: clamp(latest.x), y: clamp(latest.y) };
  const lead = Math.max(0, Math.min(elapsedMs, MAX_PREDICTION_MS));
  const extrapolate = (current: number, old: number) =>
    clamp(
      current +
        Math.max(
          -MAX_PREDICTED_DISTANCE,
          Math.min(MAX_PREDICTED_DISTANCE, ((current - old) * lead) / interval),
        ),
    );
  return {
    x: extrapolate(latest.x, previous.x),
    y: extrapolate(latest.y, previous.y),
  };
}

export function advanceMotion(
  current: Point,
  target: Point,
  frameMs: number,
): Point {
  const alpha = 1 - Math.exp(-Math.max(0, frameMs) / RESPONSE_MS);
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
}
