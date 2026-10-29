import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DemoSnapshot } from "../client";
import { useLocalDemo } from "../client";
import { Student } from "./Student";

vi.mock("../client", () => ({ useLocalDemo: vi.fn() }));

function snapshot(own: { id: string; label: string }[], placed: string[] = []) {
  return {
    code: "ABC12345",
    title: "Linha do tempo do Brasil",
    instruction: "Organize do mais antigo ao mais recente.",
    axis: { start: "Mais antigo", end: "Mais recente" },
    themeId: "historia",
    items: own,
    confirmedOrder: [],
    confirmedPositions: {},
    cards: [],
    status: "active",
    version: 7,
    previewVersionFloor: 0,
    revealed: false,
    previews: {},
    memberCount: 1,
    cardsPerParticipant: own.length,
    teacherPlays: true,
    ownItemIds: own.map((item) => item.id),
    ownPlacedIds: placed,
  } satisfies DemoSnapshot;
}

describe("tela do aluno com vários cartões", () => {
  const confirm = vi.fn();
  beforeEach(() => {
    confirm.mockReset().mockResolvedValue(undefined);
  });
  function show(state: DemoSnapshot) {
    (useLocalDemo as Mock).mockReturnValue({
      state,
      connected: true,
      error: "",
      confirm,
      preview: vi.fn(),
      send: vi.fn(),
    });
    render(<Student code="ABC12345" />);
  }

  it("mostra todos os cartões para arrastar e marca os que já estão na linha", () => {
    show(
      snapshot(
        [
          { id: "i1", label: "Chegada de Cabral ao Brasil" },
          { id: "i2", label: "Assinatura da Lei Áurea" },
        ],
        ["i2"],
      ),
    );
    expect(screen.getByText(/Seus cartões \(2\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Arrastar Chegada de Cabral/ }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Arrastar Assinatura da Lei Áurea/ }),
    ).toBeEnabled();
    const placed = screen.getAllByText("✓ na linha");
    expect(placed).toHaveLength(1);
    expect(placed[0].closest("li")).toHaveTextContent(/Lei Áurea/);
  });

  it("confirma pelo controle de posição o cartão escolhido", async () => {
    show(
      snapshot([
        { id: "i1", label: "Chegada de Cabral ao Brasil" },
        { id: "i2", label: "Assinatura da Lei Áurea" },
      ]),
    );
    fireEvent.change(screen.getByLabelText(/Cartão para posicionar/), {
      target: { value: "i2" },
    });
    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar posição escolhida" }),
    );
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("i2", 0.8, 7));
  });

  it("com um único cartão, mantém a tela simples, sem escolher o cartão", async () => {
    show(snapshot([{ id: "i1", label: "Evaporação" }]));
    expect(screen.queryByLabelText(/Cartão para posicionar/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar posição escolhida" }),
    );
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("i1", 0.5, 7));
  });
});
