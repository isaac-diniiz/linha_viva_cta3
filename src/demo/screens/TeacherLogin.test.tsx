import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherLogin } from "./TeacherLogin";

function respond(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("cadastro sem convite", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("não pede o código de convite quando o servidor não exige e não o envia", async () => {
    fetchMock.mockReturnValue(respond(201, { email: "ana@escola.br" }));
    const onSignedIn = vi.fn();
    render(<TeacherLogin onSignedIn={onSignedIn} inviteRequired={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.queryByLabelText(/Código de convite/)).toBeNull();
    expect(screen.queryByText(/código de convite/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^E-mail/), {
      target: { value: "ana@escola.br" },
    });
    fireEvent.change(screen.getByLabelText(/^Senha/), {
      target: { value: "senha-forte" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );
    await waitFor(() =>
      expect(onSignedIn).toHaveBeenCalledWith("ana@escola.br"),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/demo/api/cadastro");
    expect(JSON.parse(init.body)).toEqual({
      email: "ana@escola.br",
      senha: "senha-forte",
    });
  });

  it("pede o código quando o servidor exige, e também quando não se sabe", () => {
    const { unmount } = render(
      <TeacherLogin onSignedIn={vi.fn()} inviteRequired />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByLabelText(/Código de convite/)).toBeInTheDocument();
    unmount();
    render(<TeacherLogin onSignedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByLabelText(/Código de convite/)).toBeInTheDocument();
  });
});

describe("entrada do professor", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function fill(label: RegExp, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  it("entra com e-mail e senha", async () => {
    fetchMock.mockReturnValue(respond(200, { email: "ana@escola.br" }));
    const onSignedIn = vi.fn();
    render(<TeacherLogin onSignedIn={onSignedIn} />);
    fill(/^E-mail/, "ana@escola.br");
    fill(/^Senha/, "senha-forte");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(onSignedIn).toHaveBeenCalledWith("ana@escola.br"),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/demo/api/entrar");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      email: "ana@escola.br",
      senha: "senha-forte",
    });
  });

  it("mostra o erro do servidor e não entra", async () => {
    fetchMock.mockReturnValue(
      respond(401, { erro: "E-mail ou senha incorretos." }),
    );
    const onSignedIn = vi.fn();
    render(<TeacherLogin onSignedIn={onSignedIn} />);
    fill(/^E-mail/, "ana@escola.br");
    fill(/^Senha/, "errada-demais");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("cria a conta com o código de convite", async () => {
    fetchMock.mockReturnValue(respond(201, { email: "bia@escola.br" }));
    const onSignedIn = vi.fn();
    render(<TeacherLogin onSignedIn={onSignedIn} />);
    expect(screen.queryByLabelText(/Código de convite/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    fill(/^E-mail/, "bia@escola.br");
    fill(/^Senha/, "senha-forte");
    fill(/Código de convite/, "turma-viva");
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );
    await waitFor(() =>
      expect(onSignedIn).toHaveBeenCalledWith("bia@escola.br"),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/demo/api/cadastro");
    expect(JSON.parse(init.body)).toEqual({
      email: "bia@escola.br",
      senha: "senha-forte",
      convite: "turma-viva",
    });
  });

  it("explica quando o servidor não responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TeacherLogin onSignedIn={() => {}} />);
    fill(/^E-mail/, "ana@escola.br");
    fill(/^Senha/, "senha-forte");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/conexão/i);
  });
});
