// @vitest-environment node
import { describe, expect, it } from "vitest";
import { teacherAccounts } from "./accounts";

describe("configuração das contas de professor", () => {
  it("usa o Supabase quando a URL e a chave secreta estão definidas", () => {
    const config = teacherAccounts({
      SUPABASE_URL: "https://exemplo.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_teste",
      CONVITE_PROFESSOR: "turma-viva",
      SESSAO_SEGREDO: "s".repeat(40),
    });
    expect(config.source).toBe("supabase");
    expect(config.invite).toBe("turma-viva");
    expect(config.secret).toBe("s".repeat(40));
    expect(config.warnings).toEqual([]);
  });

  it("sem Supabase, aceita uma conta de teste para CI e uso local", async () => {
    const config = teacherAccounts({
      PROFESSOR_TESTE: "Teste@Escola.br:senha-de-teste",
    });
    expect(config.source).toBe("teste");
    expect(
      await config.directory.verify("teste@escola.br", "senha-de-teste"),
    ).toBe(true);
    expect(await config.directory.verify("teste@escola.br", "outra")).toBe(
      false,
    );
  });

  it("sem nenhuma conta configurada, ninguém entra e o servidor avisa", async () => {
    const config = teacherAccounts({});
    expect(config.source).toBe("nenhuma");
    expect(await config.directory.verify("a@b.br", "qualquer-coisa")).toBe(
      false,
    );
    await expect(
      config.directory.create("a@b.br", "senha-forte"),
    ).rejects.toThrow();
    expect(config.warnings.join("\n")).toMatch(/contas de professor/);
  });

  it("gera um segredo de sessão quando falta ou é curto demais, avisando", () => {
    const missing = teacherAccounts({});
    expect(missing.secret.length).toBeGreaterThanOrEqual(32);
    expect(missing.warnings.join("\n")).toMatch(/SESSAO_SEGREDO/);
    const short = teacherAccounts({ SESSAO_SEGREDO: "curto" });
    expect(short.secret).not.toBe("curto");
  });

  it("avisa quando não há código de convite, pois o cadastro fica fechado", () => {
    expect(teacherAccounts({}).warnings.join("\n")).toMatch(
      /CONVITE_PROFESSOR/,
    );
  });
});
