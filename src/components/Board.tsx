import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { stackLanes } from "../domain/lanes";
import type { PreviewState } from "../domain/preview";
import { AnimatedPreviewCard } from "./AnimatedPreviewCard";

export type Item = { id: string; label: string };
/** Votos dos alunos que têm o mesmo cartão; a posição da caixa é o consenso. */
export type VoteSummary = { votes: number; total: number; marks: number[] };
/** Faixas: no eixo, acima e abaixo dele, afastadas pela caixa mais alta. */
const LANE_DIRECTION = [0, -1, 1];
const LANE_MARGIN = 12;

function laneTop(lane: number, offset: number) {
  return `calc(50% + ${LANE_DIRECTION[lane] * offset}px)`;
}

function sameLanes(a: Record<string, number>, b: Record<string, number>) {
  const keys = Object.keys(b);
  return (
    keys.length === Object.keys(a).length &&
    keys.every((key) => a[key] === b[key])
  );
}

type Props = {
  items: Item[];
  order: string[];
  positions?: Record<string, number>;
  votes?: Record<string, VoteSummary>;
  /** Quantas caixas definem a largura do eixo; por padrão, o total de itens. */
  cardCount?: number;
  startLabel?: string;
  endLabel?: string;
  previews: PreviewState;
  className?: string;
  smoothPreviews?: boolean;
};

export const Board = forwardRef<HTMLDivElement, Props>(function Board(
  {
    items,
    order,
    positions,
    votes,
    cardCount = items.length,
    startLabel = "Início",
    endLabel = "Fim",
    previews,
    className = "",
    smoothPreviews = true,
  },
  ref,
) {
  const labels = new Map(items.map((item) => [item.id, item.label]));
  const boardEl = useRef<HTMLDivElement | null>(null);
  const cardEls = useRef(new Map<string, HTMLDivElement>());
  const [lanes, setLanes] = useState<Record<string, number>>({});
  const [laneOffset, setLaneOffset] = useState(0);
  const center = (id: string, index: number) =>
    positions?.[id] ?? (index + 1) / (order.length + 1);

  // mede a linha e as caixas para separar em faixas as que se cobririam
  const measure = useRef(() => {});
  measure.current = () => {
    const width = boardEl.current?.clientWidth ?? 0;
    const stacked = stackLanes(
      order.map((id, index) => ({
        center: center(id, index) * width,
        width: cardEls.current.get(id)?.offsetWidth ?? 0,
      })),
    );
    const next = Object.fromEntries(
      order.map((id, index) => [id, stacked[index]]),
    );
    setLanes((current) => (sameLanes(current, next) ? current : next));
    const tallest = Math.max(
      0,
      ...[...cardEls.current.values()].map((card) => card.offsetHeight),
    );
    setLaneOffset(tallest + LANE_MARGIN);
  };
  useLayoutEffect(() => measure.current());
  useEffect(() => {
    const board = boardEl.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(board);
    return () => observer.disconnect();
  }, []);
  const setBoard = useCallback(
    (element: HTMLDivElement | null) => {
      boardEl.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  return (
    <div
      className={`board-scroll ${className}`}
      aria-label="Eixo compartilhado"
      role="region"
      tabIndex={0}
    >
      <div
        ref={setBoard}
        className="board"
        data-testid="board-track"
        style={{
          minWidth: cardCount > 8 ? `${cardCount * 140}px` : "100%",
        }}
      >
        <div className="board-topline">
          <span>{startLabel.toUpperCase()}</span>
          <span>LINHA DA TURMA · {order.length} CARTÕES</span>
          <span>{endLabel.toUpperCase()}</span>
        </div>
        <div className="board-axis" aria-hidden="true" />
        {order.flatMap((id) =>
          votes?.[id] && votes[id].total > 1
            ? votes[id].marks.map((mark, index) => (
                <span
                  key={`vote-${id}-${index}`}
                  className="vote-mark"
                  data-testid={`vote-mark-${id}-${index}`}
                  aria-hidden="true"
                  style={{ left: `${mark * 100}%` }}
                />
              ))
            : [],
        )}
        {order.map((id, index) => (
          <div
            key={id}
            className="board-card confirmed-card"
            data-testid={`confirmed-${id}`}
            data-lane={lanes[id] ?? 0}
            ref={(element) => {
              if (element) cardEls.current.set(id, element);
              else cardEls.current.delete(id);
            }}
            style={{
              left: `${center(id, index) * 100}%`,
              top: laneTop(lanes[id] ?? 0, laneOffset),
            }}
          >
            <span className="card-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{labels.get(id) ?? "Item"}</span>
            {votes?.[id] && votes[id].total > 1 && (
              <span className="vote-count">
                {votes[id].votes} de {votes[id].total} votaram
              </span>
            )}
          </div>
        ))}
        {Object.entries(previews).map(
          ([id, preview]) =>
            labels.has(id) &&
            !preview.cancelled &&
            (smoothPreviews ? (
              <AnimatedPreviewCard
                key={`preview-${id}-${preview.dragId}`}
                id={id}
                label={labels.get(id) ?? "Item"}
                preview={preview}
              />
            ) : (
              <div
                key={`preview-${id}`}
                className="board-card preview-card direct-preview"
                data-testid={`preview-${id}`}
                data-sent-at={preview.sentAt}
                style={{
                  left: `${preview.x * 100}%`,
                  top: `${preview.y * 100}%`,
                }}
              >
                <span className="preview-dot" />
                <span>{labels.get(id)}</span>
              </div>
            )),
        )}
        {order.length === 0 &&
          !Object.values(previews).some((preview) => !preview.cancelled) && (
            <p className="board-hint">
              As caixas aparecerão aqui quando a turma começar.
            </p>
          )}
      </div>
    </div>
  );
});
