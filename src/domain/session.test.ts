import { describe, expect, it } from "vitest";
import { latestSession } from "./session";

describe("estado confirmado da sessão", () => {
  it("não substitui uma confirmação nova por evento ou consulta atrasada", () => {
    const current = { id: "s", version: 4, status: "paused" };
    expect(
      latestSession(current, { id: "s", version: 3, status: "active" }),
    ).toBe(current);
    expect(
      latestSession(current, { id: "s", version: 5, status: "active" }).version,
    ).toBe(5);
  });
});
