import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Board } from "./Board";

const items = [
  { id: "a", label: "Evaporação" },
  { id: "b", label: "Condensação" },
];

describe("projeção coletiva", () => {
  it("mostra a caixa em trânsito antes de alterar a ordem confirmada", () => {
    render(
      <Board
        items={items}
        order={["a"]}
        previews={{
          b: { dragId: "d", seq: 2, x: 0.72, y: 0.31, version: 0, sentAt: 100 },
        }}
      />,
    );
    expect(screen.getByTestId("preview-b")).toHaveClass("animated-preview");
    expect(screen.getByTestId("preview-b")).toHaveAttribute("data-x", "0.72");
    expect(screen.getByTestId("preview-b")).toHaveAttribute("data-y", "0.31");
    expect(screen.getByTestId("confirmed-a")).toBeInTheDocument();
    expect(screen.queryByTestId("confirmed-b")).not.toBeInTheDocument();
  });

  it("mantém o estado confirmado quando a prévia desaparece", () => {
    render(<Board items={items} order={["a", "b"]} previews={{}} />);
    expect(screen.getByTestId("confirmed-b")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-b")).not.toBeInTheDocument();
  });

  it("desenha cada caixa na coordenada confirmada quando ela está disponível", () => {
    render(
      <Board
        items={items}
        order={["a", "b"]}
        positions={{ a: 0.1, b: 0.8 }}
        previews={{}}
      />,
    );
    expect(screen.getByTestId("confirmed-a")).toHaveStyle({ left: "10%" });
    expect(screen.getByTestId("confirmed-b")).toHaveStyle({ left: "80%" });
  });

  it("permite que a prévia local siga o dedo sem interpolação", () => {
    render(
      <Board
        items={items}
        order={[]}
        smoothPreviews={false}
        previews={{
          a: { dragId: "d", seq: 1, x: 0.2, y: 0.4, version: 0, sentAt: 1 },
        }}
      />,
    );
    expect(screen.getByTestId("preview-a")).toHaveClass("direct-preview");
  });

  it("expande o eixo para uma turma grande sem empilhar 40 caixas no mesmo espaço", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      id: String(index),
      label: `Item ${index}`,
    }));
    render(
      <Board items={many} order={many.map((item) => item.id)} previews={{}} />,
    );
    expect(screen.getByTestId("board-track")).toHaveStyle({
      minWidth: "5600px",
    });
    expect(screen.getByLabelText("Eixo compartilhado")).toHaveClass(
      "board-scroll",
    );
  });

  it("informa quantos dos alunos que têm o mesmo cartão já votaram na posição", () => {
    render(
      <Board
        items={items}
        order={["a", "b"]}
        positions={{ a: 0.2, b: 0.8 }}
        votes={{
          a: { votes: 2, total: 3, marks: [0.1, 0.3] },
          b: { votes: 1, total: 1, marks: [0.8] },
        }}
        previews={{}}
      />,
    );
    expect(screen.getByTestId("confirmed-a")).toHaveTextContent(
      "2 de 3 votaram",
    );
    expect(screen.getByTestId("confirmed-b")).not.toHaveTextContent("votaram");
  });

  it("marca no eixo cada voto de um cartão repetido, sem nomes", () => {
    render(
      <Board
        items={items}
        order={["a"]}
        positions={{ a: 0.2 }}
        votes={{ a: { votes: 2, total: 3, marks: [0.1, 0.3] } }}
        previews={{}}
      />,
    );
    expect(screen.getByTestId("vote-mark-a-0")).toHaveStyle({ left: "10%" });
    expect(screen.getByTestId("vote-mark-a-1")).toHaveStyle({ left: "30%" });
  });

  it("permite nomear as pontas do eixo, como mais antigo e mais recente", () => {
    render(
      <Board
        items={items}
        order={[]}
        startLabel="Mais antigo"
        endLabel="Mais recente"
        previews={{}}
      />,
    );
    expect(screen.getByText("MAIS ANTIGO")).toBeInTheDocument();
    expect(screen.getByText("MAIS RECENTE")).toBeInTheDocument();
  });

  it("mantém INÍCIO e FIM quando as pontas não são nomeadas", () => {
    render(<Board items={items} order={[]} previews={{}} />);
    expect(screen.getByText("INÍCIO")).toBeInTheDocument();
    expect(screen.getByText("FIM")).toBeInTheDocument();
  });
});
