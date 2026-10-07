import { describe, expect, it } from "vitest";
import { advanceMotion, predictMotion } from "./motion";

describe("movimento visual das prévias remotas", () => {
  it("continua o movimento entre amostras sem depender da taxa do WebSocket", () => {
    const previous = { x: 0.2, y: 0.4, sentAt: 1000 };
    const latest = { x: 0.4, y: 0.5, sentAt: 1100 };
    expect(predictMotion(previous, latest, 50)).toEqual({ x: 0.5, y: 0.55 });
  });

  it("limita a previsão e mantém a caixa dentro do eixo quando o sinal atrasa", () => {
    const previous = { x: 0.7, y: 0.1, sentAt: 1000 };
    const latest = { x: 0.9, y: 0.05, sentAt: 1100 };
    expect(predictMotion(previous, latest, 1000)).toEqual({ x: 1, y: 0 });
    expect(predictMotion(previous, latest, 1000)).toEqual(
      predictMotion(previous, latest, 200),
    );
  });

  it("não extrapola amostras sem intervalo válido e suaviza de modo independente do frame rate", () => {
    const previous = { x: 0.1, y: 0.3, sentAt: 1000 };
    const latest = { x: 0.8, y: 0.6, sentAt: 1000 };
    expect(predictMotion(previous, latest, 100)).toEqual({ x: 0.8, y: 0.6 });
    const target = { x: 0.8, y: 0.6 };
    const oneFrame = advanceMotion({ x: 0.1, y: 0.3 }, target, 16);
    const twoFrames = advanceMotion(
      advanceMotion({ x: 0.1, y: 0.3 }, target, 8),
      target,
      8,
    );
    expect(oneFrame.x).toBeCloseTo(twoFrames.x, 6);
    expect(oneFrame.y).toBeCloseTo(twoFrames.y, 6);
  });
});
