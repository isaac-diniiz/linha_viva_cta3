import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CustomLineForm } from "../demo/customLine";
import { LineCreator } from "./LineCreator";

function setup(props: Partial<Parameters<typeof LineCreator>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <LineCreator
      savedKey={5}
      onSubmit={onSubmit}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSubmit, onClose, ...view };
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillValid() {
  type("Tema da linha", "Fases da escola");
  type("Ponta da esquerda", "Mais antigo");
  type("Ponta da direita", "Mais recente");
  type("Cartão 1", "Fundação");
  type("Cartão 2", "Reforma");
  type("Cartão 3", "Biblioteca");
}

describe("criar linha: formulário do professor", () => {
  it("começa com os campos do tema, das duas pontas e três cartões vazios", () => {
    setup();
    expect(screen.getByLabelText("Tema da linha")).toHaveValue("");
    expect(screen.getByLabelText("Ponta da esquerda")).toHaveValue("");
    expect(screen.getByLabelText("Ponta da direita")).toHaveValue("");
    for (const number of [1, 2, 3])
      expect(screen.getByLabelText(`Cartão ${number}`)).toHaveValue("");
    expect(screen.queryByLabelText("Cartão 4")).toBeNull();
    expect(screen.getByText("3 cartões")).toBeVisible();
  });

  it("explica que a ordem digitada é a ordem correta, da esquerda para a direita", () => {
    setup();
    expect(
      screen.getByText(/primeiro cartão fica na ponta da esquerda/i),
    ).toBeVisible();
  });

  it("adiciona e remove cartões, de 3 a 40", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }));
    expect(screen.getByLabelText("Cartão 4")).toBeVisible();
    expect(screen.getByText("4 cartões")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remover cartão 4" }));
    expect(screen.queryByLabelText("Cartão 4")).toBeNull();
    for (const number of [1, 2, 3])
      expect(
        screen.getByRole("button", { name: `Remover cartão ${number}` }),
      ).toBeDisabled();
    for (let count = 3; count < 40; count++)
      fireEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }));
    expect(screen.getByText("40 cartões")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Adicionar cartão" }),
    ).toBeDisabled();
  });

  it("troca a posição de dois cartões com os botões de subir e descer", () => {
    setup();
    type("Cartão 1", "A");
    type("Cartão 2", "B");
    type("Cartão 3", "C");
    expect(
      screen.getByRole("button", { name: "Subir cartão 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descer cartão 3" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Subir cartão 2" }));
    expect(screen.getByLabelText("Cartão 1")).toHaveValue("B");
    expect(screen.getByLabelText("Cartão 2")).toHaveValue("A");
    fireEvent.click(screen.getByRole("button", { name: "Descer cartão 2" }));
    expect(screen.getByLabelText("Cartão 2")).toHaveValue("C");
    expect(screen.getByLabelText("Cartão 3")).toHaveValue("A");
  });

  it("envia o formulário preenchido, com os cartões na ordem digitada", () => {
    const { onSubmit } = setup();
    fillValid();
    fireEvent.click(
      screen.getByRole("button", { name: "Criar e usar esta linha" }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Fases da escola",
        inicio: "Mais antigo",
        fim: "Mais recente",
        cartoes: ["Fundação", "Reforma", "Biblioteca"],
        embaralhar: true,
      }),
    );
  });

  it("deixa o professor desligar o embaralhamento", () => {
    const { onSubmit } = setup();
    fillValid();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Embaralhar os cartões/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Criar e usar esta linha" }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ embaralhar: false }),
    );
  });

  it("envia disciplina, série e instrução quando preenchidas", () => {
    const { onSubmit } = setup();
    fillValid();
    type("Disciplina", "Geografia");
    type("Série", "6º ano");
    type(/Instrução para os alunos/, "Ordenem do menor ao maior.");
    fireEvent.click(
      screen.getByRole("button", { name: "Criar e usar esta linha" }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        disciplina: "Geografia",
        serie: "6º ano",
        instrucao: "Ordenem do menor ao maior.",
      }),
    );
  });

  it("lista o que falta sem enviar e mantém o que já foi digitado", () => {
    const { onSubmit } = setup();
    type("Cartão 1", "Só este");
    fireEvent.click(
      screen.getByRole("button", { name: "Criar e usar esta linha" }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Dê um nome ao tema da linha.");
    expect(alert).toHaveTextContent("Escreva o que fica na ponta da esquerda.");
    expect(alert).toHaveTextContent("O cartão 2 está vazio.");
    expect(screen.getByLabelText("Cartão 1")).toHaveValue("Só este");
  });

  it("limita o texto de cada cartão a 60 caracteres", () => {
    setup();
    expect(screen.getByLabelText("Cartão 1")).toHaveAttribute(
      "maxlength",
      "60",
    );
  });

  it("cancela sem enviar", () => {
    const { onSubmit, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fecha sozinho quando o servidor confirma a nova linha na lista de temas", () => {
    const { onClose, rerender, onSubmit } = setup({ savedKey: 5 });
    rerender(
      <LineCreator savedKey={5} onSubmit={onSubmit} onClose={onClose} />,
    );
    expect(onClose).not.toHaveBeenCalled();
    rerender(
      <LineCreator savedKey={6} onSubmit={onSubmit} onClose={onClose} />,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("avisa que a linha fica salva na pasta de atividades do servidor", () => {
    setup();
    expect(screen.getByText(/pasta atividades/i)).toBeVisible();
    cleanup();
    setup({ storage: "arquivos" });
    expect(screen.getByText(/pasta atividades/i)).toBeVisible();
  });

  it("com o Supabase, diz que a linha continua salva depois que o servidor reinicia", () => {
    setup({ storage: "supabase" });
    expect(screen.getByText(/salva no Supabase/i)).toBeVisible();
    expect(screen.queryByText(/pasta atividades/i)).toBeNull();
    expect(screen.queryByText(/pode ser apagado/i)).toBeNull();
  });
});

const enter = (label: string) =>
  fireEvent.keyDown(screen.getByLabelText(label), { key: "Enter" });

describe("criar linha: Enter nos cartões", () => {
  it("cria outro cartão logo abaixo, com o foco nele, sem enviar o formulário", () => {
    const { onSubmit } = setup();
    fillValid();
    enter("Cartão 3");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Cartão 4")).toHaveValue("");
    expect(screen.getByLabelText("Cartão 4")).toHaveFocus();
    expect(screen.getByText("4 cartões")).toBeVisible();
  });

  it("no meio da lista, insere o novo cartão logo depois do atual", () => {
    setup();
    fillValid();
    enter("Cartão 1");
    expect(screen.getByLabelText("Cartão 1")).toHaveValue("Fundação");
    expect(screen.getByLabelText("Cartão 2")).toHaveValue("");
    expect(screen.getByLabelText("Cartão 2")).toHaveFocus();
    expect(screen.getByLabelText("Cartão 3")).toHaveValue("Reforma");
    expect(screen.getByLabelText("Cartão 4")).toHaveValue("Biblioteca");
  });

  it("se o cartão seguinte está vazio, o Enter só passa o foco para ele", () => {
    const { onSubmit } = setup();
    type("Cartão 1", "Fundação");
    enter("Cartão 1");
    expect(screen.getByLabelText("Cartão 2")).toHaveFocus();
    expect(screen.getByText("3 cartões")).toBeVisible();
    type("Cartão 2", "Reforma");
    enter("Cartão 2");
    expect(screen.getByLabelText("Cartão 3")).toHaveFocus();
    expect(screen.getByText("3 cartões")).toBeVisible();
    type("Cartão 3", "Biblioteca");
    enter("Cartão 3");
    expect(screen.getByLabelText("Cartão 4")).toHaveFocus();
    expect(screen.getByText("4 cartões")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("com 40 cartões não cria outro e também não envia", () => {
    const { onSubmit } = setup();
    for (let count = 3; count < 40; count++)
      fireEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }));
    enter("Cartão 40");
    expect(screen.getByText("40 cartões")).toBeVisible();
    expect(screen.queryByLabelText("Cartão 41")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("não cria cartão enquanto o teclado ainda está compondo uma letra (acento)", () => {
    setup();
    fireEvent.keyDown(screen.getByLabelText("Cartão 1"), {
      key: "Enter",
      isComposing: true,
    });
    expect(screen.queryByLabelText("Cartão 4")).toBeNull();
  });

  it("nos outros campos o Enter passa para o campo seguinte e não envia", () => {
    const { onSubmit } = setup();
    enter("Tema da linha");
    expect(screen.getByLabelText("Ponta da esquerda")).toHaveFocus();
    enter("Ponta da esquerda");
    expect(screen.getByLabelText("Ponta da direita")).toHaveFocus();
    enter("Ponta da direita");
    expect(screen.getByLabelText("Cartão 1")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Cartão 4")).toBeNull();
  });
});

describe("editar linha: formulário do professor", () => {
  const saved: CustomLineForm = {
    titulo: "Fases da escola",
    inicio: "Mais antigo",
    fim: "Mais recente",
    cartoes: ["Fundação", "Reforma", "Biblioteca", "Quadra"],
    disciplina: "História",
    serie: "6º ano",
    instrucao: "Ordenem do mais antigo ao mais novo.",
    embaralhar: false,
  };
  const editing = { id: "criada-fases-da-escola", form: saved };

  it("abre com tudo o que o professor tinha escrito", () => {
    setup({ editing });
    expect(screen.getByRole("heading", { name: "Editar linha" })).toBeVisible();
    expect(screen.getByLabelText("Tema da linha")).toHaveValue(
      "Fases da escola",
    );
    expect(screen.getByLabelText("Ponta da esquerda")).toHaveValue(
      "Mais antigo",
    );
    expect(screen.getByLabelText("Ponta da direita")).toHaveValue(
      "Mais recente",
    );
    expect(screen.getByLabelText("Cartão 1")).toHaveValue("Fundação");
    expect(screen.getByLabelText("Cartão 4")).toHaveValue("Quadra");
    expect(screen.getByText("4 cartões")).toBeVisible();
    expect(screen.getByLabelText("Disciplina")).toHaveValue("História");
    expect(screen.getByLabelText("Série")).toHaveValue("6º ano");
    expect(screen.getByLabelText(/Instrução para os alunos/)).toHaveValue(
      "Ordenem do mais antigo ao mais novo.",
    );
    expect(
      screen.getByRole("checkbox", { name: /Embaralhar os cartões/ }),
    ).not.toBeChecked();
  });

  it("envia as alterações no botão Salvar alterações", () => {
    const { onSubmit } = setup({ editing });
    type("Cartão 4", "Quadra nova");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(
      screen.queryByRole("button", { name: "Criar e usar esta linha" }),
    ).toBeNull();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Fases da escola",
        cartoes: ["Fundação", "Reforma", "Biblioteca", "Quadra nova"],
        disciplina: "História",
        embaralhar: false,
      }),
    );
  });

  it("sem nenhuma mudança, salvar só fecha o formulário", () => {
    const { onSubmit, onClose } = setup({ editing });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("recusa a edição inválida e mostra o motivo", () => {
    const { onSubmit } = setup({ editing });
    type("Tema da linha", "");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dê um nome ao tema da linha.",
    );
  });

  it("fecha sozinho quando o servidor confirma a edição", () => {
    const { onClose, rerender, onSubmit } = setup({
      editing,
      savedKey: "antes",
    });
    rerender(
      <LineCreator
        savedKey="antes"
        editing={editing}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    expect(onClose).not.toHaveBeenCalled();
    rerender(
      <LineCreator
        savedKey="depois"
        editing={editing}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
