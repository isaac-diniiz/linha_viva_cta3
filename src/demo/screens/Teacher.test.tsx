import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("painel do professor: criar linha", () => {
  const send = vi.fn();
  beforeEach(() => send.mockReset());
  const themes = [
    {
      id: "ciclo-da-agua",
      title: "Ciclo da água",
      subject: "Ciências",
      grade: "5º ano",
      cardCount: 3,
    },
  ];
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

  it("tem o botão Criar linha, que abre o formulário e o fecha ao cancelar", () => {
    show(snapshot({ themes }));
    expect(screen.queryByLabelText("Tema da linha")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Criar linha" }));
    expect(screen.getByLabelText("Tema da linha")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Tema da linha")).toBeNull();
  });

  it("envia ao servidor a linha montada pelo professor", () => {
    show(snapshot({ themes }));
    fireEvent.click(screen.getByRole("button", { name: "Criar linha" }));
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type("Tema da linha", "Fases da escola");
    type("Ponta da esquerda", "Mais antigo");
    type("Ponta da direita", "Mais recente");
    type("Cartão 1", "Fundação");
    type("Cartão 2", "Reforma");
    type("Cartão 3", "Biblioteca");
    fireEvent.click(
      screen.getByRole("button", { name: "Criar e usar esta linha" }),
    );
    expect(send).toHaveBeenCalledWith({
      type: "createTheme",
      line: expect.objectContaining({
        titulo: "Fases da escola",
        inicio: "Mais antigo",
        fim: "Mais recente",
        cartoes: ["Fundação", "Reforma", "Biblioteca"],
      }),
    });
  });

  it("trava o botão depois de iniciar e explica como criar outra linha", () => {
    show(snapshot({ themes, status: "active" }));
    expect(screen.getByRole("button", { name: "Criar linha" })).toBeDisabled();
    expect(
      screen.getByText(/Só dá para criar uma linha antes de iniciar/),
    ).toBeInTheDocument();
  });
});

describe("painel do professor: editar e apagar linhas criadas", () => {
  const send = vi.fn();
  beforeEach(() => send.mockReset());
  const themes = [
    {
      id: "ciclo-da-agua",
      title: "Ciclo da água",
      subject: "Ciências",
      grade: "5º ano",
      cardCount: 3,
    },
    {
      id: "criada-fases-da-escola",
      title: "Fases da escola",
      subject: "Minhas linhas",
      grade: "Livre",
      cardCount: 3,
    },
  ];
  const customLines = [
    {
      id: "criada-fases-da-escola",
      titulo: "Fases da escola",
      inicio: "Mais antigo",
      fim: "Mais recente",
      cartoes: ["Fundação", "Reforma", "Biblioteca"],
      embaralhar: true,
    },
  ];
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

  it("o formulário diz onde a linha será guardada", () => {
    show(snapshot({ themes, customLines: [], linesStorage: "supabase" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar linha" }));
    expect(screen.getByText(/salva no Supabase/i)).toBeVisible();
  });

  it("lista as linhas criadas, cada uma com Editar e Apagar", () => {
    show(snapshot({ themes, customLines }));
    expect(screen.getByText("Suas linhas criadas")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Editar Fases da escola" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Apagar Fases da escola" }),
    ).toBeEnabled();
  });

  it("não mostra a lista quando ainda não há linhas criadas", () => {
    show(snapshot({ themes, customLines: [] }));
    expect(screen.queryByText("Suas linhas criadas")).toBeNull();
  });

  it("Editar abre o formulário já preenchido e envia a edição com o id da linha", () => {
    show(snapshot({ themes, customLines }));
    fireEvent.click(
      screen.getByRole("button", { name: "Editar Fases da escola" }),
    );
    expect(screen.getByRole("heading", { name: "Editar linha" })).toBeVisible();
    expect(screen.getByLabelText("Tema da linha")).toHaveValue(
      "Fases da escola",
    );
    expect(screen.getByLabelText("Cartão 3")).toHaveValue("Biblioteca");
    fireEvent.change(screen.getByLabelText("Tema da linha"), {
      target: { value: "Fases da nossa escola" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(send).toHaveBeenCalledWith({
      type: "updateTheme",
      id: "criada-fases-da-escola",
      line: expect.objectContaining({
        titulo: "Fases da nossa escola",
        cartoes: ["Fundação", "Reforma", "Biblioteca"],
      }),
    });
  });

  it("Apagar pede confirmação e só então envia", () => {
    show(snapshot({ themes, customLines }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apagar Fases da escola" }),
    );
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText(/não pode ser desfeito/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sim, apagar" }));
    expect(send).toHaveBeenCalledWith({
      type: "deleteTheme",
      id: "criada-fases-da-escola",
    });
  });

  it("dá para desistir de apagar", () => {
    show(snapshot({ themes, customLines }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apagar Fases da escola" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Não apagar" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText(/não pode ser desfeito/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Apagar Fases da escola" }),
    ).toBeVisible();
  });

  it("trava Editar e Apagar depois de iniciar a atividade", () => {
    show(snapshot({ themes, customLines, status: "active" }));
    expect(
      screen.getByRole("button", { name: "Editar Fases da escola" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Apagar Fases da escola" }),
    ).toBeDisabled();
  });
});

describe("painel do professor: conduzir a aula sem perder a turma", () => {
  const send = vi.fn();
  const confirm = vi.fn();
  beforeEach(() => {
    send.mockReset();
    confirm.mockReset().mockResolvedValue(undefined);
  });
  function show(state: DemoSnapshot) {
    (useLocalDemo as Mock).mockReturnValue({
      state,
      connected: true,
      error: "",
      send,
      confirm,
      preview: vi.fn(),
    });
    render(<Teacher />);
  }

  /** Arrasta o cartão do professor e o solta sobre a trilha. */
  function dropOwnCard() {
    const card = screen.getByRole("button", { name: /Arrastar Evaporação/ });
    card.setPointerCapture = vi.fn();
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 40, clientY: 30 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 40, clientY: 30 });
  }

  it("Encerrar pede confirmação e dá para desistir", () => {
    show(snapshot({ status: "active" }));
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText(/Encerrar a atividade\?/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continuar a aula" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText(/Encerrar a atividade\?/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, encerrar" }));
    expect(send).toHaveBeenCalledWith({ type: "status", status: "ended" });
  });

  it("Nova rodada pede confirmação, avisa que a linha será apagada e mantém o código", () => {
    show(snapshot({ status: "active" }));
    expect(
      screen.queryByRole("button", { name: /Reiniciar demonstração/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nova rodada" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText(/linha atual será apagada/)).toBeVisible();
    expect(screen.getByText(/código da turma continua o mesmo/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sim, nova rodada" }));
    expect(send).toHaveBeenCalledWith({ type: "reset" });
  });

  it("depois de encerrar, a nova rodada avisa que a turma recebe outro código", () => {
    show(snapshot({ status: "ended" }));
    fireEvent.click(screen.getByRole("button", { name: "Nova rodada" }));
    expect(screen.getByText(/código novo/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(send).not.toHaveBeenCalled();
  });

  it("mostra o estado da atividade em destaque", () => {
    show(snapshot({ status: "paused" }));
    expect(
      screen.getByRole("status", { name: "Estado da atividade" }),
    ).toHaveTextContent("Pausada");
  });

  it("a preparação fica aberta antes de iniciar e recolhida depois, sem empurrar a trilha", () => {
    show(snapshot({ status: "waiting" }));
    const setup = () =>
      screen.getByText("Preparação da atividade").closest("details")!;
    expect(setup()).toHaveAttribute("open");
    expect(
      screen.getByRole("checkbox", { name: "Participar com cartões" }),
    ).toBeVisible();
  });

  it("depois de iniciar, a preparação começa recolhida", () => {
    show(snapshot({ status: "active" }));
    const setup = screen
      .getByText("Preparação da atividade")
      .closest("details")!;
    expect(setup).not.toHaveAttribute("open");
    expect(
      screen.getByRole("checkbox", { name: "Participar com cartões" }),
    ).not.toBeVisible();
  });

  it("confirmação de cartão aparece como sucesso, não como erro", async () => {
    show(snapshot({ status: "active", version: 2 }));
    dropOwnCard();
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    const notice = await screen.findByText(/foi colocado na linha/);
    expect(notice).not.toHaveClass("error");
    expect(notice).toHaveAttribute("role", "status");
  });

  it("erro do servidor continua como alerta", async () => {
    confirm.mockRejectedValueOnce(new Error("A linha mudou. Tente de novo."));
    show(snapshot({ status: "active", version: 2 }));
    dropOwnCard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A linha mudou");
    expect(alert).toHaveClass("error");
  });

  it("a referência revelada aparece acima da trilha", () => {
    const { container } = (() => {
      (useLocalDemo as Mock).mockReturnValue({
        state: snapshot({
          status: "paused",
          revealed: true,
          reference: ["Evaporação", "Condensação"],
        }),
        connected: true,
        error: "",
        send,
        confirm,
        preview: vi.fn(),
      });
      return render(<Teacher />);
    })();
    const panel = screen.getByRole("region", {
      name: "Sequência de referência",
    });
    const board = container.querySelector(".track-scroll")!;
    expect(
      panel.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
