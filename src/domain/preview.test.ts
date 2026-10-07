import { describe, expect, it } from "vitest";
import { acceptPreview, cancelPreview, expirePreviews } from "./preview";

describe("prévia transitória", () => {
  it("ignora sequências atrasadas e versões já confirmadas", () => {
    const first = acceptPreview(
      {},
      "item-1",
      { dragId: "d", seq: 2, x: 0.4, y: 0.5, version: 1, sentAt: 100 },
      1,
    );
    expect(
      acceptPreview(
        first,
        "item-1",
        { dragId: "d", seq: 1, x: 0.1, y: 0.1, version: 1, sentAt: 101 },
        1,
      ),
    ).toEqual(first);
    expect(
      acceptPreview(
        first,
        "item-1",
        { dragId: "d", seq: 3, x: 0.6, y: 0.5, version: 1, sentAt: 102 },
        2,
      ),
    ).toEqual(first);
  });

  it("remove a caixa transitória quando o gesto expira", () => {
    const state = acceptPreview(
      {},
      "item-1",
      { dragId: "d", seq: 1, x: 0.4, y: 0.5, version: 0, sentAt: 100 },
      0,
    );
    expect(expirePreviews(state, 2101, 2000)).toEqual({});
  });

  it("mede expiração pela chegada da mensagem sem alterar o horário do gesto", () => {
    const state = acceptPreview(
      {},
      "item-1",
      {
        dragId: "d",
        seq: 1,
        x: 0.4,
        y: 0.5,
        version: 0,
        sentAt: 100,
        receivedAt: 500,
      },
      0,
    );
    expect(expirePreviews(state, 2400, 2000)).toEqual(state);
    expect(expirePreviews(state, 2500, 2000)).toEqual({});
  });

  it("não restaura um arraste cancelado quando chega uma mensagem atrasada", () => {
    const first = acceptPreview(
      {},
      "item-1",
      { dragId: "d", seq: 2, x: 0.4, y: 0.5, version: 0, sentAt: 100 },
      0,
    );
    const cancelled = cancelPreview(first, "item-1", {
      dragId: "d",
      seq: 3,
      x: 0.4,
      y: 0.5,
      version: 0,
      sentAt: 150,
    });
    expect(cancelled["item-1"].cancelled).toBe(true);
    expect(
      acceptPreview(
        cancelled,
        "item-1",
        { dragId: "d", seq: 3, x: 0.9, y: 0.7, version: 0, sentAt: 200 },
        0,
      ),
    ).toEqual(cancelled);
    expect(
      acceptPreview(
        cancelled,
        "item-1",
        { dragId: "new", seq: 1, x: 0.2, y: 0.3, version: 0, sentAt: 201 },
        0,
      )["item-1"].cancelled,
    ).toBeFalsy();
  });
});
