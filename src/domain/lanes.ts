/** Caixa na linha, em pixels: centro horizontal e largura. */
export type Span = { center: number; width: number };

/** Espaço mínimo entre duas caixas na mesma faixa, em pixels. */
const GAP = 8;

/**
 * Distribui as caixas em faixas de altura para que caixas próximas não se
 * cubram, como acontece no celular em pé. Percorre da esquerda para a direita
 * e põe cada caixa na primeira faixa livre; sem faixa livre, usa a que libera
 * espaço antes. A ordem da linha continua dada só pela posição horizontal.
 * Devolve a faixa (0 = central) de cada caixa, na ordem recebida.
 */
export function stackLanes(spans: Span[], maxLanes = 3): number[] {
  const lanes = new Array<number>(spans.length).fill(0);
  const rightEdges: number[] = [];
  const byPosition = spans
    .map((span, index) => ({ ...span, index }))
    .sort((a, b) => a.center - b.center);
  for (const span of byPosition) {
    const left = span.center - span.width / 2;
    let lane = rightEdges.findIndex((right) => right + GAP <= left);
    if (lane === -1)
      lane =
        rightEdges.length < maxLanes
          ? rightEdges.length
          : rightEdges.indexOf(Math.min(...rightEdges));
    rightEdges[lane] = span.center + span.width / 2;
    lanes[span.index] = lane;
  }
  return lanes;
}
