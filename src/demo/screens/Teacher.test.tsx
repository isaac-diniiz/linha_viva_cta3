import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DemoSnapshot } from "../client";
import { useLocalDemo } from "../client";
import { Teacher } from "./Teacher";

vi.mock("../client", () => ({ useLocalDemo: vi.fn() }));

function snapshot(overrides: Partial<DemoSnapshot> = {}): DemoSnapshot {
  return {
    code: "DEMO1234",
    title: "Ciclo da água",
    instruction: "Organize as etapas.",
    axis: { start: "Início", end: "Fim" },
    themeId: "ciclo-da-agua",
    items: [{ id: "evaporacao", label: "Evaporação" }],
    confirmedOrder: [],
    confirmedPositions: {},
    cards: [],
    status: "waiting",
    version: 0,
    previewVersionFloor: 0,
    revealed: false,
    previews: {},
    memberCount: 0,
    cardsPerParticipant: 1,
    teacherPlays: true,
    ownItemIds: ["evaporacao"],
    ownPlacedIds: [],
    ...overrides,
  };
}

describe("painel do professor: participar com cartões", () => {
  const send = vi.fn();
  beforeEach(() => send.mockReset());
  function show(state: DemoSnapshot) {
    (useLocalDemo as Mock).mockReturnValue({
      state,
      connected: true,
      error: "",
      send,
      confirm: vi.fn(),
      preview: vi.fn(),
    });
    render(<Teacher />);
  }

  it("mostra a escolha marcada e envia quando o professor deixa de participar", () => {
    show(snapshot());
    const toggle = screen.getByRole("checkbox", {
      name: "Participar com cartões",
    });
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    expect(send).toHaveBeenCalledWith({ type: "teacherPlays", value: false });
  });

  it("trava a escolha depois de iniciar", () => {
    show(snapshot({ status: "active" }));
    expect(
      screen.getByRole("checkbox", { name: "Participar com cartões" }),
    ).toBeDisabled();
  });

  it("sem participação, não mostra cartões do professor e explica a distribuição", () => {
    show(
      snapshot({
        teacherPlays: false,
        items: [],
        ownItemIds: [],
      }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Participar com cartões" }),
    ).not.toBeChecked();
    expect(screen.queryByRole("button", { name: /^Arrastar/ })).toBeNull();
    expect(
      screen.getByText(/todos os cartões vão para os alunos/i),
    ).toBeVisible();
  });
});
