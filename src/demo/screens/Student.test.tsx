import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DemoSnapshot } from "../client";
import { useLocalDemo } from "../client";
import { placeInSlots } from "../../domain/track";
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
    // 2 cartões em jogo: a trilha tem 2 casas; a casa 2 fica no centro da 2ª metade
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    expect(screen.getByText("Casa 2 de 2")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar posição escolhida" }),
    );
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("i2", 0.75, 7));
  });

  it("numa casa ocupada, o cartão entra antes do ocupante, que é empurrado", async () => {
    show({
      ...snapshot([{ id: "i1", label: "Evaporação" }]),
      items: [
        { id: "i1", label: "Evaporação" },
        { id: "outro", label: "Condensação" },
      ],
      cards: [
        {
          id: "condensacao",
          label: "Condensação",
          votes: 1,
          total: 1,
          marks: [0.25],
        },
      ],
      confirmedOrder: ["condensacao"],
      confirmedPositions: { condensacao: 0.25 },
    });
    // a casa 1 está com Condensação
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } });
    expect(screen.getByText("Casa 1 de 2")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar posição escolhida" }),
    );
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    const [itemId, position] = confirm.mock.calls[0];
    expect(itemId).toBe("i1");
    // o cartão fica com a casa 1 e Condensação é empurrada para a casa 2
    expect(placeInSlots([position, 0.25], 2)).toEqual([0, 1]);
    expect(position).toBeLessThan(0.25);
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

describe("tela do aluno na revelação", () => {
  function show(state: DemoSnapshot) {
    (useLocalDemo as Mock).mockReturnValue({
      state,
      connected: true,
      error: "",
      confirm: vi.fn(),
      preview: vi.fn(),
      send: vi.fn(),
    });
    render(<Student code="ABC12345" />);
  }
  const own = [{ id: "i1", label: "Chegada de Cabral ao Brasil" }];

  it("avisa para olhar a projeção, sem mostrar a resposta no celular", () => {
    show({
      ...snapshot(own),
      status: "paused",
      revealed: true,
      reference: ["Chegada de Cabral ao Brasil", "Assinatura da Lei Áurea"],
    });
    expect(screen.getByText(/resposta foi revelada/i)).toHaveTextContent(
      /olhe a projeção/i,
    );
    expect(
      screen.queryByText("Assinatura da Lei Áurea"),
    ).not.toBeInTheDocument();
  });

  it("não avisa antes da revelação", () => {
    show(snapshot(own));
    expect(
      screen.queryByText(/resposta foi revelada/i),
    ).not.toBeInTheDocument();
  });
});

describe("tela do aluno: mensagens e fechamento", () => {
  const confirm = vi.fn();
  beforeEach(() => confirm.mockReset().mockResolvedValue(undefined));
  const own = [{ id: "i1", label: "Chegada de Cabral ao Brasil" }];
  function mock(state: DemoSnapshot) {
    (useLocalDemo as Mock).mockReturnValue({
      state,
      connected: true,
      error: "",
      confirm,
      preview: vi.fn(),
      send: vi.fn(),
    });
  }
  const confirmChoice = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar posição escolhida" }),
    );

  it("erro ao confirmar aparece como alerta, não como aviso verde", async () => {
    confirm.mockRejectedValueOnce(new Error("A linha mudou. Tente de novo."));
    mock(snapshot(own));
    render(<Student code="ABC12345" />);
    confirmChoice();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A linha mudou");
    expect(alert).toHaveClass("error");
  });

  it("a mensagem da jogada some quando o professor muda o estado da atividade", async () => {
    mock(snapshot(own));
    const { rerender } = render(<Student code="ABC12345" />);
    confirmChoice();
    expect(
      await screen.findByText(/colocada na linha coletiva/),
    ).toBeInTheDocument();
    mock({ ...snapshot(own), status: "paused" });
    rerender(<Student code="ABC12345" />);
    expect(screen.queryByText(/colocada na linha coletiva/)).toBeNull();
  });

  it("a mensagem da jogada some na nova rodada, quando a linha recomeça", async () => {
    mock(snapshot(own));
    const { rerender } = render(<Student code="ABC12345" />);
    confirmChoice();
    await screen.findByText(/colocada na linha coletiva/);
    // nova rodada já iniciada: a versão da linha volta para trás
    mock({ ...snapshot(own), version: 1 });
    rerender(<Student code="ABC12345" />);
    expect(screen.queryByText(/colocada na linha coletiva/)).toBeNull();
  });

  it("ao encerrar, mostra um fechamento e tira os controles de posição", () => {
    mock({ ...snapshot(own), status: "ended" });
    render(<Student code="ABC12345" />);
    expect(
      screen.getByRole("heading", { name: /Atividade encerrada/ }),
    ).toBeVisible();
    expect(screen.getByText(/Obrigado por participar/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Confirmar posição escolhida" }),
    ).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("ao encerrar, não pede mais para ajustar o voto do grupo", () => {
    const shared = [
      { id: "i1", label: "Evaporação" },
      { id: "colega", label: "Evaporação" },
    ];
    mock({ ...snapshot([shared[0]]), items: shared, status: "active" });
    const { rerender } = render(<Student code="ABC12345" />);
    expect(screen.getByTestId("shared-card-hint")).toBeInTheDocument();
    mock({ ...snapshot([shared[0]]), items: shared, status: "ended" });
    rerender(<Student code="ABC12345" />);
    expect(screen.queryByTestId("shared-card-hint")).toBeNull();
  });
});

describe("tela do aluno: o próprio cartão na revelação", () => {
  function show(state: DemoSnapshot) {
    (useLocalDemo as Mock).mockReturnValue({
      state,
      connected: true,
      error: "",
      confirm: vi.fn(),
      preview: vi.fn(),
      send: vi.fn(),
    });
    render(<Student code="ABC12345" />);
  }
  const line = {
    items: [
      { id: "i1", label: "Evaporação" },
      { id: "i2", label: "Condensação" },
      { id: "i3", label: "Precipitação" },
    ],
    cards: [
      { id: "cond", label: "Condensação", votes: 1, total: 1, marks: [] },
      { id: "evap", label: "Evaporação", votes: 1, total: 1, marks: [] },
    ],
    confirmedOrder: ["cond", "evap"],
    confirmedPositions: { cond: 0.1, evap: 0.5 },
    status: "paused" as const,
    revealed: true,
    answer: ["Evaporação", "Condensação", "Precipitação"],
  };
  const own = (ids: string[]) =>
    line.items.filter((item) => ids.includes(item.id));

  it("cartão fora do lugar: diz onde ficou e qual é a casa certa, só no próprio celular", () => {
    show({ ...snapshot(own(["i1"])), ...line, ownItemIds: ["i1"] });
    const result = screen.getByRole("region", {
      name: "Seu cartão na resposta",
    });
    expect(result).toHaveTextContent(
      "Evaporação: ficou na casa 2; a casa certa é a 1.",
    );
    expect(result).not.toHaveTextContent("Condensação");
  });

  it("cartão na casa certa recebe a confirmação", () => {
    show({
      ...snapshot(own(["i2"])),
      ...line,
      // nesta resposta a Condensação vem primeiro, e é a casa onde ela está
      answer: ["Condensação", "Evaporação", "Precipitação"],
      ownItemIds: ["i2"],
    });
    expect(
      screen.getByRole("region", { name: "Seu cartão na resposta" }),
    ).toHaveTextContent("Condensação: ✓ na casa certa (1)");
  });

  it("cartão que não foi para a linha mostra a casa certa", () => {
    show({ ...snapshot(own(["i3"])), ...line, ownItemIds: ["i3"] });
    expect(
      screen.getByRole("region", { name: "Seu cartão na resposta" }),
    ).toHaveTextContent(
      "Precipitação: não foi para a linha; a casa certa é a 3.",
    );
  });

  it("a trilha do celular não compara os cartões dos colegas: a resposta fica na projeção", () => {
    show({ ...snapshot(own(["i1"])), ...line, ownItemIds: ["i1"] });
    expect(screen.getByTestId("confirmed-cond")).not.toHaveTextContent(
      /casa certa/i,
    );
    expect(screen.getByTestId("confirmed-evap")).not.toHaveTextContent(
      /casa certa/i,
    );
  });

  it("antes de revelar, não mostra resultado", () => {
    show({
      ...snapshot(own(["i1"])),
      ...line,
      revealed: false,
      answer: undefined,
      ownItemIds: ["i1"],
    });
    expect(
      screen.queryByRole("region", { name: "Seu cartão na resposta" }),
    ).toBeNull();
  });
});
