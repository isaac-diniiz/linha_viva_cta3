import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findTheme, loadActivities } from "./catalog";

const valid = (id: string) =>
  JSON.stringify({
    id,
    disciplina: "Ciências",
    serie: "5º ano",
    titulo: "Atividade",
    instrucao: "Ordene.",
    eixo: { inicio: "Início", fim: "Fim" },
    cartoes: [
      { id: "a", texto: "A", ordem: 1 },
      { id: "b", texto: "B", ordem: 2 },
      { id: "c", texto: "C", ordem: 3 },
    ],
  });

describe("catálogo de atividades em arquivos", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });
  function folder(files: Record<string, string>): string {
    dir = mkdtempSync(join(tmpdir(), "linha-viva-atividades-"));
    for (const [name, content] of Object.entries(files))
      writeFileSync(join(dir, name), content);
    return dir;
  }

  it("carrega todas as atividades cadastradas no repositório sem rejeições", () => {
    const { themes, rejected } = loadActivities(resolve("atividades"));
    expect(rejected).toEqual([]);
    expect(themes.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["ciclo-da-agua", "narrativa-viva"]),
    );
    expect(findTheme(themes, "narrativa-viva").subject).toBe(
      "Língua Portuguesa",
    );
  });

  it("rejeita arquivos inválidos com a mensagem do problema e mantém os válidos", () => {
    const { themes, rejected } = loadActivities(
      folder({
        "boa.json": valid("boa"),
        "quebrada.json": "{ sem fechar",
        "repetida.json": valid("repetida").replace('"id":"b"', '"id":"a"'),
        "trocada.json": valid("outro-nome"),
        "LEIA-ME.txt": "não é atividade",
      }),
    );
    expect(themes.map((theme) => theme.id)).toEqual(["boa"]);
    const byFile = Object.fromEntries(
      rejected.map((entry) => [entry.file, entry.errors.join("\n")]),
    );
    expect(Object.keys(byFile).sort()).toEqual([
      "quebrada.json",
      "repetida.json",
      "trocada.json",
    ]);
    expect(byFile["quebrada.json"]).toMatch(/JSON/);
    expect(byFile["repetida.json"]).toMatch(/repetido/);
    expect(byFile["trocada.json"]).toMatch(/trocada\.json/);
  });

  it("explica quando a pasta de atividades não existe", () => {
    const { themes, rejected } = loadActivities(
      join(tmpdir(), "nao-existe-lv"),
    );
    expect(themes).toEqual([]);
    expect(rejected[0].errors[0]).toMatch(/pasta/i);
  });

  it("recusa um tema que não está no catálogo", () => {
    const { themes } = loadActivities(folder({ "boa.json": valid("boa") }));
    expect(() => findTheme(themes, "inexistente")).toThrow(/tema/i);
  });
});
