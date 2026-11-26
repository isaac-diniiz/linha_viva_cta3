import { forwardRef, useEffect, useRef, useState } from "react";
import type { PreviewState } from "../domain/preview";
import {
  placeInSlots,
  pointAt,
  positionAt,
  predictOnTrack,
  slotCell,
  trackColumns,
  type Cell,
} from "../domain/track";
import { AnimatedPreviewCard } from "./AnimatedPreviewCard";
import type { Item, VoteSummary } from "./Board";

/** Espaço do cabeçalho da trilha e altura de cada fileira de casas, em pixels. */
const TOP = 48;
const ROW_HEIGHT = 132;
const BOTTOM = 24;

type Props = {
  items: Item[];
  order: string[];
  positions?: Record<string, number>;
  votes?: Record<string, VoteSummary>;
  /** Número de casas: um por cartão diferente em jogo. */
  slots: number;
  startLabel?: string;
  endLabel?: string;
  previews: PreviewState;
  className?: string;
  smoothPreviews?: boolean;
  /** Casa certa (a partir de 0) de cada cartão; só depois de revelar. */
  answer?: Record<string, number>;
};

/**
 * Posição da trilha (0 a 1) mais perto de um ponto da tela. Usa as medidas que
 * a própria trilha publica nos atributos data-*, para o arraste do aluno
 * encaixar no mesmo desenho que ele está vendo.
 */
export function trackPosition(
  track: HTMLElement,
  clientX: number,
  clientY: number,
): number {
  const slots = Number(track.dataset.slots);
  const columns = Number(track.dataset.columns);
  const top = Number(track.dataset.top);
  const rowHeight = Number(track.dataset.rowHeight);
  const rect = track.getBoundingClientRect();
  const cellWidth = rect.width / columns;
  return positionAt(
    {
      col: (clientX - rect.left) / cellWidth - 0.5,
      row: (clientY - rect.top - top) / rowHeight - 0.5,
    },
    slots,
    columns,
  );
}

/**
 * Linha da turma como trilha de tabuleiro: casas numeradas em serpentina, um
 * cartão por casa na ordem confirmada, e prévias que andam pela trilha.
 */
export const TrackBoard = forwardRef<HTMLDivElement, Props>(function TrackBoard(
  {
    items,
    order,
    positions = {},
    votes,
    slots: wanted,
    startLabel = "Início",
    endLabel = "Fim",
    previews,
    className = "",
    smoothPreviews = true,
    answer,
  },
  ref,
) {
  const slots = Math.max(1, wanted, order.length);
  const [width, setWidth] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(track.clientWidth));
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const columns = trackColumns(width, slots);
  const rows = Math.ceil(slots / columns);
  const height = TOP + rows * ROW_HEIGHT + BOTTOM;
  const left = (cell: Cell) => `${((cell.col + 0.5) / columns) * 100}%`;
  const top = (cell: Cell) => TOP + (cell.row + 0.5) * ROW_HEIGHT;
  const labels = new Map(items.map((item) => [item.id, item.label]));
  const cardWidth = `min(210px, calc(${100 / columns}% - 16px))`;
  const placed = placeInSlots(
    order.map((id) => positions[id] ?? 0.5),
    slots,
  );
  const path = Array.from({ length: slots }, (_, slot) => {
    const cell = slotCell(slot, columns);
    return `${cell.col + 0.5},${top(cell)}`;
  }).join(" ");

  return (
    <div className={`track-scroll ${className}`}>
      <div
        ref={(element) => {
          trackRef.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        className="track"
        role="region"
        aria-label="Trilha da turma"
        data-testid="board-track"
        data-slots={slots}
        data-columns={columns}
        data-top={TOP}
        data-row-height={ROW_HEIGHT}
        style={{ height }}
      >
        <div className="board-topline">
          LINHA DA TURMA · {order.length} DE {slots} CASAS
        </div>
        <svg
          className="track-path"
          viewBox={`0 0 ${columns} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline points={path} vectorEffect="non-scaling-stroke" />
        </svg>
        {Array.from({ length: slots }, (_, slot) => {
          const cell = slotCell(slot, columns);
          return (
            <div
              key={`slot-${slot}`}
              className="track-slot"
              data-testid={`track-slot-${slot}`}
              data-number={slot + 1}
              style={{ left: left(cell), top: top(cell), width: cardWidth }}
            >
              <span className="track-slot-number">{slot + 1}</span>
              {slot === 0 && (
                <span className="track-end start">{startLabel}</span>
              )}
              {slot === slots - 1 && (
                <span className="track-end end">{endLabel}</span>
              )}
            </div>
          );
        })}
        {order.flatMap((id) =>
          votes?.[id] && votes[id].total > 1
            ? votes[id].marks.map((mark, index) => {
                const cell = pointAt(mark, slots, columns);
                return (
                  <span
                    key={`vote-${id}-${index}`}
                    className="vote-mark"
                    data-testid={`vote-mark-${id}-${index}`}
                    aria-hidden="true"
                    style={{ left: left(cell), top: top(cell) + 48 }}
                  />
                );
              })
            : [],
        )}
        {order.map((id, index) => {
          const cell = slotCell(placed[index], columns);
          const correct = answer?.[id];
          // na revelação, o texto diz se o cartão está na casa certa: não depende só da cor
          const check =
            correct === undefined
              ? ""
              : correct === placed[index]
                ? " in-place"
                : " out-of-place";
          return (
            <div
              key={id}
              className={`board-card confirmed-card track-card${check}`}
              data-testid={`confirmed-${id}`}
              data-slot={placed[index]}
              style={{ left: left(cell), top: top(cell), width: cardWidth }}
            >
              <span className="card-index">{placed[index] + 1}</span>
              <span>{labels.get(id) ?? "Item"}</span>
              {correct !== undefined && (
                <span className="answer-check">
                  {correct === placed[index]
                    ? "✓ casa certa"
                    : `Casa certa: ${correct + 1}`}
                </span>
              )}
              {votes?.[id] && votes[id].total > 1 && (
                <span className="vote-count">
                  {votes[id].votes} de {votes[id].total} votaram
                </span>
              )}
            </div>
          );
        })}
        {Object.entries(previews).map(([id, preview]) => {
          if (!labels.has(id) || preview.cancelled) return null;
          const cell = pointAt(preview.x, slots, columns);
          const x = (cell.col + 0.5) / columns;
          return smoothPreviews ? (
            <AnimatedPreviewCard
              key={`preview-${id}-${preview.dragId}`}
              id={id}
              label={labels.get(id) ?? "Item"}
              preview={preview}
              predict={(previous, latest, elapsedMs) => {
                // a previsão anda pela trilha e só então vira ponto da tela
                const ahead = predictOnTrack(
                  previous,
                  latest,
                  elapsedMs,
                  slots,
                  columns,
                );
                return {
                  x: (ahead.col + 0.5) / columns,
                  y: top(ahead) / height,
                };
              }}
            />
          ) : (
            <div
              key={`preview-${id}`}
              className="board-card preview-card direct-preview"
              data-testid={`preview-${id}`}
              data-sent-at={preview.sentAt}
              data-position={preview.x}
              style={{ left: `${x * 100}%`, top: top(cell), width: cardWidth }}
            >
              <span className="preview-dot" />
              <span>{labels.get(id)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
