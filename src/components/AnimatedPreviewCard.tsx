import { useLayoutEffect, useRef } from "react";
import type { Point } from "../domain/axis";
import { advanceMotion, predictMotion } from "../domain/motion";
import type { Preview } from "../domain/preview";

type Props = { id: string; label: string; preview: Preview };

export function AnimatedPreviewCard({ id, label, preview }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef({
    previous: null as Preview | null,
    latest: preview,
    arrivedAt: performance.now(),
  });
  const positionRef = useRef<Point>({ x: preview.x, y: preview.y });
  const sizeRef = useRef({ width: 0, height: 0 });
  const drawRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const old = sampleRef.current.latest;
    if (preview.dragId !== old.dragId) {
      sampleRef.current.previous = null;
      positionRef.current = { x: preview.x, y: preview.y };
    } else if (preview.seq > old.seq) {
      sampleRef.current.previous = old;
    } else {
      return;
    }
    sampleRef.current.latest = preview;
    sampleRef.current.arrivedAt = performance.now();
    drawRef.current();
  }, [preview]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const board = card?.parentElement;
    if (!card || !board) return;
    const measure = () => {
      sizeRef.current = {
        width: board.clientWidth,
        height: board.clientHeight,
      };
      drawRef.current();
    };
    drawRef.current = () => {
      const { width, height } = sizeRef.current;
      const { x, y } = positionRef.current;
      card.style.transform = `translate3d(${x * width}px, ${y * height}px, 0) translate(-50%, -50%)`;
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(board);
    measure();
    if (typeof requestAnimationFrame !== "function")
      return () => observer?.disconnect();
    let frame = 0;
    let lastFrame = performance.now();
    const reducedMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : { matches: false };
    const tick = (now: number) => {
      const { previous, latest, arrivedAt } = sampleRef.current;
      const target = reducedMotion.matches
        ? { x: latest.x, y: latest.y }
        : predictMotion(previous, latest, now - arrivedAt);
      positionRef.current = reducedMotion.matches
        ? target
        : advanceMotion(
            positionRef.current,
            target,
            Math.min(now - lastFrame, 50),
          );
      lastFrame = now;
      drawRef.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      drawRef.current = () => {};
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="board-card preview-card animated-preview"
      data-testid={`preview-${id}`}
      data-sent-at={preview.sentAt}
      data-x={preview.x}
      data-y={preview.y}
      style={{ left: 0, top: 0, transition: "none" }}
    >
      <span className="preview-dot" />
      <span>{label}</span>
    </div>
  );
}
