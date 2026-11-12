import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { useLocalDemo } from "../client";
import { TeacherGate } from "./TeacherGate";

vi.mock("../client", () => ({ useLocalDemo: vi.fn() }));

function respond(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

describe("acesso ao painel do professor", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    (useLocalDemo as Mock).mockReturnValue({
      state: null,
      connected: true,
      error: "",
      send: vi.fn(),
      confirm: vi.fn(),
      preview: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sem sessão, mostra a entrada e não abre o painel", async () => {
    fetchMock.mockReturnValue(respond(401, { erro: "Entre como professor." }));
    render(<TeacherGate />);
    expect(
      await screen.findByRole("heading", { name: "Entrar como professor" }),
    ).toBeInTheDocument();
    expect(useLocalDemo).not.toHaveBeenCalled();
  });

  it("se o servidor não exige convite, o cadastro não pede o código", async () => {
    fetchMock.mockReturnValue(
      respond(401, {
        erro: "Entre como professor.",
        conviteObrigatorio: false,
      }),
    );
    render(<TeacherGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    expect(screen.queryByLabelText(/Código de convite/)).toBeNull();
  });

  it("se o servidor exige convite, ou não informa nada, o cadastro pede o código", async () => {
    fetchMock.mockReturnValue(
      respond(401, { erro: "Entre como professor.", conviteObrigatorio: true }),
    );
    const first = render(<TeacherGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    expect(screen.getByLabelText(/Código de convite/)).toBeInTheDocument();
    first.unmount();
    fetchMock.mockReturnValue(respond(401, { erro: "Entre como professor." }));
    render(<TeacherGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    expect(screen.getByLabelText(/Código de convite/)).toBeInTheDocument();
  });

  it("no modo local, sem login, abre o painel direto", async () => {
    fetchMock.mockReturnValue(respond(200, { email: null }));
    render(<TeacherGate />);
    expect(await screen.findByText(/CÓDIGO DA TURMA/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });

  it("com sessão, mostra quem está conectado e sai de volta para a entrada", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { email: "ana@escola.br" }))
      .mockReturnValueOnce(respond(204))
      .mockReturnValueOnce(respond(401, { erro: "Entre como professor." }));
    render(<TeacherGate />);
    expect(
      await screen.findByText(/Conectado como ana@escola\.br/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(
      await screen.findByRole("heading", { name: "Entrar como professor" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/demo/api/sair", {
        method: "POST",
      }),
    );
  });

  it("depois de sair, o cadastro continua sem pedir convite se o servidor não exige", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { email: "ana@escola.br" }))
      .mockReturnValueOnce(respond(204))
      .mockReturnValueOnce(
        respond(401, {
          erro: "Entre como professor.",
          conviteObrigatorio: false,
        }),
      );
    render(<TeacherGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    expect(screen.queryByLabelText(/Código de convite/)).toBeNull();
  });

  it("se o aviso de sair falhar, volta para a entrada pedindo o código por precaução", async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { email: "ana@escola.br" }))
      .mockReturnValueOnce(respond(204))
      .mockReturnValueOnce(respond(200, { email: "ana@escola.br" }));
    render(<TeacherGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    expect(screen.getByLabelText(/Código de convite/)).toBeInTheDocument();
  });
});
