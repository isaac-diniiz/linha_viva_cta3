import { forwardRef } from "react";
import type { PreviewState } from "../domain/preview";
import { AnimatedPreviewCard } from "./AnimatedPreviewCard";

export type Item = { id: string; label: string };
/** Votos dos alunos que têm o mesmo cartão; a posição da caixa é o consenso. */
export type VoteSummary = { votes: number; total: number; marks: number[] };
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
  return (
    <div
      className={`board-scroll ${className}`}
      aria-label="Eixo compartilhado"
      role="region"
      tabIndex={0}
    >
      <div
        ref={ref}
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
            style={{
              left: `${(positions?.[id] ?? (index + 1) / (order.length + 1)) * 100}%`,
              top: "50%",
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
