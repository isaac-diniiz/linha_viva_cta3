// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { AccountExistsError } from "./auth";
import { supabaseDirectory, type AuthClient } from "./supabaseDirectory";

type Result = {
  data: unknown;
  error: { code?: string; status?: number } | null;
};

function fakeClient(created: Result, signedIn: Result) {
  const createUser = vi.fn().mockResolvedValue(created);
  const signInWithPassword = vi.fn().mockResolvedValue(signedIn);
  const client = {
    auth: { admin: { createUser }, signInWithPassword },
  } as unknown as AuthClient;
  return { client, createUser, signInWithPassword };
}

const ok: Result = { data: {}, error: null };

describe("contas de professor no Supabase", () => {
  it("cria a conta já confirmada, sem depender de e-mail", async () => {
    const { client, createUser } = fakeClient(ok, ok);
    await supabaseDirectory(client).create("ana@escola.br", "senha-forte");
    expect(createUser).toHaveBeenCalledWith({
      email: "ana@escola.br",
      password: "senha-forte",
      email_confirm: true,
    });
  });

  it("avisa quando o e-mail já tem conta", async () => {
    const { client } = fakeClient(
      { data: null, error: { code: "email_exists", status: 422 } },
      ok,
    );
    await expect(
      supabaseDirectory(client).create("ana@escola.br", "senha-forte"),
    ).rejects.toBeInstanceOf(AccountExistsError);
  });

  it("propaga outras falhas ao criar a conta", async () => {
    const { client } = fakeClient(
      { data: null, error: { code: "unexpected_failure", status: 500 } },
      ok,
    );
    const failure = supabaseDirectory(client).create("a@b.br", "senha-forte");
    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.not.toBeInstanceOf(AccountExistsError);
  });

  it("confirma a senha certa e recusa a errada sem lançar erro", async () => {
    const right = fakeClient(ok, { data: { session: {} }, error: null });
    expect(
      await supabaseDirectory(right.client).verify("ana@escola.br", "senha"),
    ).toBe(true);
    expect(right.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@escola.br",
      password: "senha",
    });
    const wrong = fakeClient(ok, {
      data: null,
      error: { code: "invalid_credentials", status: 400 },
    });
    expect(
      await supabaseDirectory(wrong.client).verify("ana@escola.br", "x"),
    ).toBe(false);
  });

  it("lança erro quando o Supabase não responde, em vez de recusar a senha", async () => {
    const down = fakeClient(ok, {
      data: null,
      error: { status: 0 },
    });
    await expect(
      supabaseDirectory(down.client).verify("ana@escola.br", "senha"),
    ).rejects.toThrow();
  });
});
