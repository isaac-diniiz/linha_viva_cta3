import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { normalizedPoint, type Point } from "../domain/axis";
import type { Preview } from "../domain/preview";
import { newId } from "../domain/id";

type Props = {
  label: string;
  boardRef: RefObject<HTMLDivElement | null>;
  version: number;
  disabled: boolean;
  onLocalPreview: (preview: Preview | null) => void;
  onPreview: (preview: Preview, event: "move" | "cancel") => void;
  onDrop: (x: number, version: number) => Promise<void>;
};

const SEND_INTERVAL_MS = 167;

export function DragCard({
  label,
  boardRef,
  version,
  disabled,
  onLocalPreview,
  onPreview,
  onDrop,
}: Props) {
  const drag = useRef<{
    id: string;
    seq: number;
    lastSent: number;
    point: Point;
    version: number;
    startedAt: number;
    pending: Preview | null;
    timer: number | null;
  } | null>(null);
  const [moving, setMoving] = useState(false);

  function locate(event: PointerEvent<HTMLButtonElement>): Point {
    const rect = boardRef.current?.getBoundingClientRect();
    return normalizedPoint(
      event.clientX,
      event.clientY,
      rect ?? { left: 0, top: 0, width: 1, height: 1 },
    );
  }

  function broadcast(point: Point, force = false) {
    const current = drag.current;
    if (!current) return;
    current.point = point;
    const now = Date.now();
    const preview: Preview = {
      dragId: current.id,
      seq: ++current.seq,
      ...point,
      version: current.version,
      sentAt: now,
      startedAt: current.startedAt,
    };
    onLocalPreview(preview);
    if (force || now - current.lastSent >= SEND_INTERVAL_MS) {
      if (current.timer !== null) window.clearTimeout(current.timer);
      current.timer = null;
      current.pending = null;
      current.lastSent = now;
      onPreview(preview, "move");
    } else {
      current.pending = preview;
      if (current.timer === null) {
        current.timer = window.setTimeout(
          () => {
            const active = drag.current;
            if (!active || active.id !== current.id || !active.pending) return;
            active.lastSent = Date.now();
            onPreview(active.pending, "move");
            active.pending = null;
            active.timer = null;
          },
          SEND_INTERVAL_MS - (now - current.lastSent),
        );
      }
    }
  }

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: newId(),
      seq: 0,
      lastSent: 0,
      point: locate(event),
      version,
      startedAt: Date.now(),
      pending: null,
      timer: null,
    };
    setMoving(true);
    broadcast(locate(event), true);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current) broadcast(locate(event));
  }

  async function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    broadcast(locate(event));
    if (current.timer !== null) window.clearTimeout(current.timer);
    drag.current = null;
    setMoving(false);
    try {
      await onDrop(current.point.x, current.version);
    } finally {
      onPreview(
        {
          dragId: current.id,
          seq: current.seq + 1,
          ...current.point,
          version: current.version,
          sentAt: Date.now(),
          startedAt: current.startedAt,
        },
        "cancel",
      );
      onLocalPreview(null);
    }
  }

  function cancel() {
    const current = drag.current;
    if (!current) return;
    if (current.timer !== null) window.clearTimeout(current.timer);
    onPreview(
      {
        dragId: current.id,
        seq: current.seq + 1,
        ...current.point,
        version: current.version,
        sentAt: Date.now(),
        startedAt: current.startedAt,
      },
      "cancel",
    );
    drag.current = null;
    setMoving(false);
    onLocalPreview(null);
  }

  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);

  return (
    <button
      type="button"
      className={`drag-card ${moving ? "is-moving" : ""}`}
      disabled={disabled}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={(event) => {
        void finish(event);
      }}
      onPointerCancel={cancel}
      aria-label={`Arrastar ${label}`}
    >
      <span>{label}</span>
      <small>Segure e arraste</small>
    </button>
  );
}
