import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemePicker } from "./ThemePicker";

const themes = [
  {
    id: "ciclo-da-agua",
    title: "Ciclo da água",
    subject: "Ciências",
    grade: "5º ano",
    cardCount: 3,
  },
  {
    id: "historia",
    title: "Linha do tempo do Brasil",
    subject: "História",
    grade: "8º ano",
    cardCount: 10,
  },
  {
    id: "narrativa-viva",
    title: "Narrativa Viva",
    subject: "Língua Portuguesa",
    grade: "4º ano",
    cardCount: 6,
  },
  {
    id: "metamorfose",
    title: "Metamorfose da borboleta",
    subject: "Ciências",
    grade: "3º ano",
    cardCount: 4,
  },
];

describe("escolha do tema", () => {
  it("agrupa as atividades por disciplina", () => {
    render(
      <ThemePicker
        themes={themes}
        selectedId="ciclo-da-agua"
        disabled={false}
        onChoose={() => {}}
      />,
    );
    const science = screen.getByRole("group", { name: "Ciências" });
    expect(within(science).getAllByRole("radio")).toHaveLength(2);
    expect(
      within(
        screen.getByRole("group", { name: "Língua Portuguesa" }),
      ).getByRole("radio", { name: /Narrativa Viva/ }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("group")
        .map((group) => group.getAttribute("aria-label"))
        .filter(Boolean),
    ).toEqual(["Ciências", "História", "Língua Portuguesa"]);
  });

  it("mostra a série de cada atividade e ordena por série dentro da disciplina", () => {
    render(
      <ThemePicker
        themes={themes}
        selectedId="ciclo-da-agua"
        disabled={false}
        onChoose={() => {}}
      />,
    );
    const science = within(screen.getByRole("group", { name: "Ciências" }));
    const radios = science.getAllByRole("radio");
    expect(radios[0]).toHaveAccessibleName(/Metamorfose.*3º ano/);
    expect(radios[1]).toHaveAccessibleName(/Ciclo da água.*5º ano/);
  });

  it("lista os temas com a quantidade de cartões e marca o escolhido", () => {
    render(
      <ThemePicker
        themes={themes}
        selectedId="historia"
        disabled={false}
        onChoose={() => {}}
      />,
    );
    expect(
      screen.getByRole("radio", { name: /Linha do tempo do Brasil/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Ciclo da água/ }),
    ).not.toBeChecked();
    expect(screen.getByText(/10 cartões/)).toBeInTheDocument();
  });

  it("avisa qual tema o professor escolheu", () => {
    const onChoose = vi.fn();
    render(
      <ThemePicker
        themes={themes}
        selectedId="ciclo-da-agua"
        disabled={false}
        onChoose={onChoose}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Linha do tempo/ }));
    expect(onChoose).toHaveBeenCalledWith("historia");
  });

  it("trava a escolha e explica como mudar depois que a atividade começou", () => {
    render(
      <ThemePicker
        themes={themes}
        selectedId="ciclo-da-agua"
        disabled
        onChoose={() => {}}
      />,
    );
    expect(
      screen.getByRole("radio", { name: /Linha do tempo/ }),
    ).toBeDisabled();
    expect(screen.getByText(/Reiniciar demonstração/)).toBeInTheDocument();
  });
});
