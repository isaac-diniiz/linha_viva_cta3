import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JoinCode } from "./JoinCode";

describe("entrada do aluno pelo código da turma", () => {
  it("entra com o código digitado, sem espaços e em maiúsculas", () => {
    const onJoin = vi.fn();
    render(<JoinCode onJoin={onJoin} />);
    fireEvent.change(screen.getByLabelText(/código da turma/i), {
      target: { value: " 1a2b 3c4d " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/ }));
    expect(onJoin).toHaveBeenCalledWith("1A2B3C4D");
  });

  it("não envia sem código", () => {
    const onJoin = vi.fn();
    render(<JoinCode onJoin={onJoin} />);
    expect(screen.getByRole("button", { name: /Entrar/ })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: /Entrar/ }));
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("explica o erro e deixa digitar de novo", () => {
    render(<JoinCode error="Código da turma inválido." onJoin={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/inválido/);
    expect(screen.getByLabelText(/código da turma/i)).toBeEnabled();
  });
});
