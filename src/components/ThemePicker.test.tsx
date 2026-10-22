import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemePicker } from "./ThemePicker";

const themes = [
  { id: "ciclo-da-agua", title: "Ciclo da água", cardCount: 3 },
  { id: "historia", title: "Linha do tempo do Brasil", cardCount: 10 },
];

describe("escolha do tema", () => {
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
