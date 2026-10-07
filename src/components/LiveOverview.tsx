import type { PreviewState } from "../domain/preview";
import type { Item } from "./Board";

export function LiveOverview({
  items,
  previews,
}: {
  items: Item[];
  previews: PreviewState;
}) {
  const labels = new Map(items.map((item) => [item.id, item.label]));
  return (
    <section className="live-overview" aria-label="Movimentos ao vivo da turma">
      <div className="live-overview-heading">
        CAIXAS EM MOVIMENTO · VISÃO DA LINHA INTEIRA
      </div>
      <div className="live-overview-axis" aria-hidden="true" />
      {Object.entries(previews).map(
        ([id, preview]) =>
          labels.has(id) &&
          !preview.cancelled && (
            <div
              key={id}
              className="live-overview-card"
              data-testid={`live-${id}`}
              data-sent-at={preview.sentAt}
              style={{
                left: `${8 + preview.x * 84}%`,
                top: `${28 + preview.y * 57}%`,
              }}
            >
              {labels.get(id)}
            </div>
          ),
      )}
      {!Object.values(previews).some((preview) => !preview.cancelled) && (
        <p>A turma ainda não está movendo caixas.</p>
      )}
    </section>
  );
}
