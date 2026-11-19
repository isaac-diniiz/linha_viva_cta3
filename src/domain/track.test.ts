import { describe, expect, it } from "vitest";
import {
  dropPosition,
  placeInSlots,
  pointAt,
  predictOnTrack,
  positionAt,
  slotCell,
  slotCenter,
  slotOf,
  trackColumns,
} from "./track";

describe("trilha em serpentina", () => {
  it("numera as casas em fileiras que vão e voltam", () => {
    // 7 casas em 3 colunas: 0 1 2 / 5 4 3 / 6
    expect([0, 1, 2, 3, 4, 5, 6].map((slot) => slotCell(slot, 3))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 1, row: 1 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
    ]);
  });

  it("converte entre a posição na trilha (0 a 1) e a casa", () => {
    expect(slotCenter(0, 4)).toBeCloseTo(0.125);
    expect(slotCenter(3, 4)).toBeCloseTo(0.875);
    expect(slotOf(0, 4)).toBe(0);
    expect(slotOf(0.26, 4)).toBe(1);
    expect(slotOf(1, 4)).toBe(3);
    for (let slot = 0; slot < 5; slot++)
      expect(slotOf(slotCenter(slot, 5), 5)).toBe(slot);
  });

  it("acompanha a trilha de forma contínua entre duas casas, inclusive na virada da fileira", () => {
    // 4 casas em 2 colunas: a casa 1 fica no fim da 1ª fileira, a 2 logo abaixo
    expect(pointAt(slotCenter(1, 4), 4, 2)).toEqual({ col: 1, row: 0 });
    const between = pointAt((slotCenter(1, 4) + slotCenter(2, 4)) / 2, 4, 2);
    expect(between.col).toBeCloseTo(1);
    expect(between.row).toBeCloseTo(0.5);
    expect(pointAt(0, 4, 2)).toEqual({ col: 0, row: 0 });
    expect(pointAt(1, 4, 2)).toEqual({ col: 0, row: 1 });
  });

  it("acha a posição na trilha mais perto de um ponto qualquer da tela", () => {
    for (const t of [slotCenter(0, 6), 0.3, 0.5, slotCenter(4, 6), 0.71])
      expect(positionAt(pointAt(t, 6, 3), 6, 3)).toBeCloseTo(t);
    // um ponto fora da trilha, um pouco abaixo da casa 1, cai na casa 1
    expect(slotOf(positionAt({ col: 1, row: 0.3 }, 6, 3), 6)).toBe(1);
  });

  it("põe cada cartão numa casa diferente, mantendo a ordem e perto de onde foi solto", () => {
    expect(placeInSlots([0.1, 0.12, 0.9], 5)).toEqual([0, 1, 4]);
    // muitos cartões no fim: são empurrados para trás, sem sair da trilha
    expect(placeInSlots([0.9, 0.95, 0.99], 4)).toEqual([1, 2, 3]);
    expect(placeInSlots([], 3)).toEqual([]);
    const slots = placeInSlots([0.2, 0.2, 0.2, 0.2], 4);
    expect(slots).toEqual([0, 1, 2, 3]);
  });

  /** Casa em que fica o cartão solto, junto dos outros já na trilha. */
  function landing(slot: number, others: number[], slots: number) {
    const dropped = dropPosition(slot, others, slots);
    const all = [...others, dropped].sort((a, b) => a - b);
    const placed = placeInSlots(all, slots);
    return {
      dropped: placed[all.indexOf(dropped)],
      others: others.map((x) => placed[all.indexOf(x)]),
    };
  }

  it("soltar numa casa livre põe o cartão no centro dela", () => {
    expect(dropPosition(3, [], 5)).toBeCloseTo(slotCenter(3, 5));
    expect(landing(1, [0.9, 0.95], 4)).toEqual({ dropped: 1, others: [2, 3] });
  });

  it("soltar numa casa ocupada encaixa o cartão ali e empurra o ocupante", () => {
    expect(landing(2, [slotCenter(2, 5)], 5)).toEqual({
      dropped: 2,
      others: [3],
    });
    // a primeira casa ocupada ainda deixa espaço antes
    expect(landing(0, [slotCenter(0, 5)], 5)).toEqual({
      dropped: 0,
      others: [1],
    });
  });

  it("entra entre o cartão anterior e o ocupante, mesmo quando o ocupante já foi empurrado", () => {
    // A estava na casa 1; B foi solto ali e empurrou A para a casa 2
    const a = slotCenter(1, 8);
    const b = dropPosition(1, [a], 8);
    expect(landing(1, [a], 8)).toEqual({ dropped: 1, others: [2] });
    // C é solto na casa 2, onde A está agora: fica entre B e A
    expect(landing(2, [b, a], 8)).toEqual({ dropped: 2, others: [1, 3] });
  });

  it("na ponta final cheia, entra antes do ocupante e os anteriores recuam, sem sair da trilha", () => {
    // os dois cartões estão nas duas últimas casas; não há casa depois da 4ª
    expect(landing(3, [0.95, 0.97], 4)).toEqual({ dropped: 2, others: [1, 3] });
  });

  it("a previsão do arraste continua pela trilha, virando a fileira em vez de sair pela borda", () => {
    // 8 casas, 6 por fileira: a casa 5 (6ª) é o fim da 1ª fileira; depois a trilha desce
    const previous = { x: slotCenter(4, 8), y: 0.5, sentAt: 0 };
    const latest = { x: slotCenter(5, 8), y: 0.5, sentAt: 167 };
    const ahead = predictOnTrack(previous, latest, 180, 8, 6);
    expect(ahead.col).toBeLessThanOrEqual(5);
    expect(ahead.row).toBeGreaterThan(0.5);
    // sem amostra anterior, fica onde a última amostra disse
    expect(predictOnTrack(null, latest, 180, 8, 6)).toEqual({ col: 5, row: 0 });
  });

  it("escolhe quantas casas cabem por fileira conforme a largura da tela", () => {
    expect(trackColumns(1200, 10)).toBe(6);
    expect(trackColumns(360, 10)).toBe(2);
    expect(trackColumns(1200, 3)).toBe(3);
    // sem medida (antes de desenhar), usa até 6 por fileira
    expect(trackColumns(0, 10)).toBe(6);
  });
});
