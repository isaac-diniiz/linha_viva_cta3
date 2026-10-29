import { describe, expect, it } from "vitest";
import { stackLanes } from "./lanes";

const card = (center: number, width = 100) => ({ center, width });

describe("faixas das caixas confirmadas na linha", () => {
  it("mantém na faixa central as caixas que não se tocam", () => {
    expect(stackLanes([card(60), card(200), card(340)])).toEqual([0, 0, 0]);
  });

  it("separa em faixas diferentes caixas que se cobririam", () => {
    const lanes = stackLanes([card(150), card(170), card(190)]);
    expect(new Set(lanes).size).toBe(3);
  });

  it("volta à faixa central depois de um espaço livre", () => {
    expect(stackLanes([card(100), card(140), card(400)])).toEqual([0, 1, 0]);
  });

  it("devolve as faixas na ordem recebida, mesmo com as caixas fora de ordem", () => {
    expect(stackLanes([card(400), card(140), card(100)])).toEqual([0, 1, 0]);
  });

  it("nunca passa do número de faixas e usa a que tem mais espaço", () => {
    const lanes = stackLanes([card(100), card(110), card(120), card(300)], 3);
    expect(Math.max(...lanes)).toBeLessThanOrEqual(2);
    expect(lanes[3]).toBe(0);
    const crowded = stackLanes([card(100), card(105), card(110), card(115)], 3);
    expect(Math.max(...crowded)).toBeLessThanOrEqual(2);
  });

  it("considera a largura real de cada caixa", () => {
    // caixas largas a 150 px de distância se tocam; estreitas, não
    expect(stackLanes([card(100, 180), card(250, 180)])).toEqual([0, 1]);
    expect(stackLanes([card(100, 112), card(250, 112)])).toEqual([0, 0]);
  });

  it("sem caixas, não há faixas", () => {
    expect(stackLanes([])).toEqual([]);
  });
});
