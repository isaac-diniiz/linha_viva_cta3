import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { DemoSnapshot } from "../client";
import { useLocalDemo } from "../client";
import { Projection } from "./Projection";

vi.mock("../client", () => ({ useLocalDemo: vi.fn() }));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,x") },
}));

function snapshot(overrides: Partial<DemoSnapshot> = {}): DemoSnapshot {
  return {
    code: "ABCD1234",
    title: "Ciclo da água",
    instruction: "Organize as etapas.",
    axis: { start: "Início", end: "Fim" },
    themeId: "ciclo-da-agua",
    items: [],
    confirmedOrder: [],
    confirmedPositions: {},
    cards: [],
    status: "active",
    version: 3,
    previewVersionFloor: 0,
    revealed: false,
    previews: {},
    memberCount: 3,
    cardsPerParticipant: 1,
    teacherPlays: true,
    ...overrides,
  } satisfies DemoSnapshot;
}

function show(state: DemoSnapshot, connected = true) {
  (useLocalDemo as Mock).mockReturnValue({ state, connected, error: "" });
  return render(<Projection />);
}

describe("projeção legível em sala", () => {
  it("depois de iniciar, quem chega atrasado ainda vê o código e onde entrar", () => {
    show(snapshot({ status: "active" }));
    const join = screen.getByRole("region", { name: "Entrar na turma" });
    expect(within(join).getByText("ABCD1234")).toBeInTheDocument();
    expect(within(join).getByText(/\/demo\/aluno/)).toBeInTheDocument();
  });

  it("pausada, o código continua visível; encerrada, some", () => {
    const { unmount } = show(snapshot({ status: "paused" }));
    expect(
      screen.getByRole("region", { name: "Entrar na turma" }),
    ).toBeInTheDocument();
    unmount();
    show(snapshot({ status: "ended" }));
    expect(
      screen.queryByRole("region", { name: "Entrar na turma" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("ABCD1234")).not.toBeInTheDocument();
  });

  it("mostra o estado da atividade em destaque, com texto e não só cor", () => {
    const { unmount } = show(snapshot({ status: "paused" }));
    expect(
      screen.getByRole("status", { name: "Estado da atividade" }),
    ).toHaveTextContent("Pausada");
    unmount();
    show(snapshot({ status: "active" }));
    expect(
      screen.getByRole("status", { name: "Estado da atividade" }),
    ).toHaveTextContent("Em construção");
  });

  it("a referência revelada aparece numerada, na ordem, antes da trilha", () => {
    const { container } = show(
      snapshot({
        status: "paused",
        revealed: true,
        reference: ["Evaporação", "Condensação", "Precipitação"],
      }),
    );
    const panel = screen.getByRole("region", {
      name: "Sequência de referência",
    });
    const steps = within(panel).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining("Evaporação"),
      expect.stringContaining("Condensação"),
      expect.stringContaining("Precipitação"),
    ]);
    // fica acima da trilha, para não sair da tela do projetor
    const board = container.querySelector(".demo-projection-board")!;
    expect(
      panel.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sem revelar, não mostra a referência", () => {
    show(snapshot({ reference: undefined }));
    expect(
      screen.queryByRole("region", { name: "Sequência de referência" }),
    ).not.toBeInTheDocument();
  });

  it("ao encerrar, mostra o fechamento da turma acima da linha final", () => {
    const { container } = show(snapshot({ status: "ended" }));
    const closing = screen.getByRole("region", { name: "Fechamento" });
    expect(closing).toHaveTextContent(/linha final da turma/i);
    expect(closing).toHaveTextContent(/obrigado/i);
    const board = container.querySelector(".track-scroll")!;
    expect(
      closing.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sem encerrar, não mostra o fechamento", () => {
    show(snapshot({ status: "paused" }));
    expect(screen.queryByRole("region", { name: "Fechamento" })).toBeNull();
  });

  it("na revelação, a trilha da projeção compara cada cartão com a resposta", () => {
    show(
      snapshot({
        status: "paused",
        revealed: true,
        reference: ["Evaporação", "Condensação"],
        answer: ["Evaporação", "Condensação"],
        cards: [
          { id: "cond", label: "Condensação", votes: 1, total: 1, marks: [] },
          { id: "evap", label: "Evaporação", votes: 1, total: 1, marks: [] },
        ],
        confirmedOrder: ["cond", "evap"],
        confirmedPositions: { cond: 0.25, evap: 0.75 },
        items: [
          { id: "i1", label: "Evaporação" },
          { id: "i2", label: "Condensação" },
        ],
      }),
    );
    expect(screen.getByTestId("confirmed-evap")).toHaveTextContent(
      "Casa certa: 1",
    );
    expect(screen.getByTestId("confirmed-cond")).toHaveTextContent(
      "Casa certa: 2",
    );
  });
});
