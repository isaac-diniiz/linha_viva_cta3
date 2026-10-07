import { describe, expect, it } from "vitest";
import { clampPoint, insertAtX, normalizedPoint } from "./axis";

describe("eixo e arraste", () => {
  it("converte o gesto 2D para coordenadas relativas, limitadas a 0..1", () => {
    expect(
      normalizedPoint(150, 250, {
        left: 100,
        top: 200,
        width: 100,
        height: 100,
      }),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(clampPoint({ x: 3, y: -2 })).toEqual({ x: 1, y: 0 });
  });

  it("usa apenas x para encaixar a caixa na ordem confirmada", () => {
    expect(insertAtX(["a", "b"], "c", 0.51)).toEqual(["a", "c", "b"]);
    expect(insertAtX(["a", "b"], "a", 1)).toEqual(["b", "a"]);
  });
});
