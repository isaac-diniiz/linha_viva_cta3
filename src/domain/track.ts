/**
 * Trilha de tabuleiro em serpentina: casas numeradas em fileiras que vão e
 * voltam. A posição de um cartão continua sendo um número de 0 a 1, agora ao
 * longo da trilha, então o servidor e o consenso dos votos não mudam; cada tela
 * escolhe quantas casas cabem por fileira e desenha a mesma trilha do seu jeito.
 */

import { predictMotion, type MotionSample } from "./motion";

/** Lugar na grade da trilha; frações ficam entre duas casas vizinhas. */
export type Cell = { col: number; row: number };

const MAX_COLUMNS = 6;
const MIN_CELL_WIDTH = 150;
/** Distância máxima, em casas, entre o cartão inserido e o vizinho que ele empurra. */
const INSERT_GAP = 0.25;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Coluna e fileira de uma casa: fileiras pares vão para a direita, ímpares voltam. */
export function slotCell(slot: number, columns: number): Cell {
  const row = Math.floor(slot / columns);
  const offset = slot % columns;
  return { col: row % 2 === 0 ? offset : columns - 1 - offset, row };
}

/** Posição (0 a 1) do centro de uma casa. */
export function slotCenter(slot: number, slots: number): number {
  return (slot + 0.5) / slots;
}

/** Casa em que cai uma posição da trilha. */
export function slotOf(position: number, slots: number): number {
  return clamp(Math.floor(position * slots), 0, slots - 1);
}

/** Índice contínuo de casa (0 = centro da primeira) para uma posição. */
function slotIndex(position: number, slots: number) {
  return clamp(position * slots - 0.5, 0, slots - 1);
}

/** Ponto da grade correspondente a uma posição, andando pelo caminho entre as casas. */
export function pointAt(
  position: number,
  slots: number,
  columns: number,
): Cell {
  const index = slotIndex(position, slots);
  const from = Math.floor(index);
  const to = Math.min(from + 1, slots - 1);
  const fraction = index - from;
  const a = slotCell(from, columns);
  const b = slotCell(to, columns);
  return {
    col: a.col + (b.col - a.col) * fraction,
    row: a.row + (b.row - a.row) * fraction,
  };
}

/** Posição da trilha mais próxima de um ponto da grade (onde o dedo está). */
export function positionAt(
  point: Cell,
  slots: number,
  columns: number,
): number {
  if (slots <= 1) return 0.5;
  let best = { distance: Infinity, index: 0 };
  for (let slot = 0; slot < slots - 1; slot++) {
    const a = slotCell(slot, columns);
    const b = slotCell(slot + 1, columns);
    const dx = b.col - a.col;
    const dy = b.row - a.row;
    const fraction = clamp(
      ((point.col - a.col) * dx + (point.row - a.row) * dy) /
        (dx * dx + dy * dy),
      0,
      1,
    );
    const distance = Math.hypot(
      point.col - (a.col + dx * fraction),
      point.row - (a.row + dy * fraction),
    );
    if (distance < best.distance) best = { distance, index: slot + fraction };
  }
  return (best.index + 0.5) / slots;
}

/**
 * Casa de cada cartão, a partir das posições já em ordem crescente: cada um fica
 * na casa mais perto de onde foi solto, sem dividir casa e sem sair da trilha.
 */
export function placeInSlots(positions: number[], slots: number): number[] {
  const placed: number[] = [];
  positions.forEach((position, index) => {
    const wanted = slotOf(position, slots);
    placed.push(index === 0 ? wanted : Math.max(wanted, placed[index - 1] + 1));
  });
  for (let index = placed.length - 1; index >= 0; index--) {
    const limit =
      index === placed.length - 1 ? slots - 1 : placed[index + 1] - 1;
    placed[index] = Math.min(placed[index], limit);
  }
  return placed;
}

/**
 * Posição enviada ao soltar um cartão numa casa, dadas as posições dos outros
 * cartões da trilha (em ordem crescente). O cartão fica depois de todos os que
 * estão nas casas anteriores e antes dos que estão a partir dela: numa casa
 * livre, no centro dela; numa ocupada, ele entra ali e empurra o ocupante.
 */
export function dropPosition(
  slot: number,
  others: number[],
  slots: number,
): number {
  const placed = placeInSlots(others, slots);
  const before = others.filter((_, index) => placed[index] < slot);
  const after = others.filter((_, index) => placed[index] >= slot);
  const low = before.length ? before[before.length - 1] : 0;
  const high = after.length ? after[0] : 1;
  const center = slotCenter(slot, slots);
  if (center > low && center < high) return center;
  const gap = Math.min(INSERT_GAP / slots, (high - low) / 2);
  // o centro caiu fora do intervalo: fica colado ao vizinho do lado da casa
  return center <= low ? low + gap : high - gap;
}

/** Casas por fileira que cabem na largura da tela (até 6; sem medida, 6). */
export function trackColumns(width: number, slots: number): number {
  const fit = width > 0 ? Math.floor(width / MIN_CELL_WIDTH) : MAX_COLUMNS;
  return Math.max(1, Math.min(slots, MAX_COLUMNS, Math.max(2, fit)));
}

/**
 * Onde desenhar a prévia de um arraste entre duas amostras: a previsão anda ao
 * longo da trilha (e vira a fileira junto com ela) e só depois vira ponto da grade.
 */
export function predictOnTrack(
  previous: MotionSample | null,
  latest: MotionSample,
  elapsedMs: number,
  slots: number,
  columns: number,
): Cell {
  const predicted = predictMotion(previous, latest, elapsedMs);
  return pointAt(predicted.x, slots, columns);
}
