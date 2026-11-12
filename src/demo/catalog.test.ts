import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteActivity,
  findTheme,
  loadActivities,
  replaceActivity,
  saveActivity,
} from "./catalog";

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

  it("salva uma atividade criada como arquivo, e ela volta a ser carregada", () => {
    const where = folder({});
    expect(saveActivity(where, "minha", JSON.parse(valid("minha")))).toBe(true);
    const { themes, rejected } = loadActivities(where);
    expect(rejected).toEqual([]);
    expect(themes.map((theme) => theme.id)).toEqual(["minha"]);
  });

  it("não sobrescreve um arquivo que já existe", () => {
    const where = folder({ "minha.json": valid("minha") });
    const before = readFileSync(join(where, "minha.json"), "utf8");
    const other = { ...JSON.parse(valid("minha")), titulo: "Outra" };
    expect(saveActivity(where, "minha", other)).toBe(false);
    expect(readFileSync(join(where, "minha.json"), "utf8")).toBe(before);
  });

  it("avisa, sem quebrar, quando a pasta não aceita gravação", () => {
    const where = folder({ arquivo: "não é pasta" });
    expect(
      saveActivity(join(where, "arquivo"), "minha", JSON.parse(valid("minha"))),
    ).toBe(false);
  });

  it("substitui o arquivo de uma atividade criada, e a nova versão é a carregada", () => {
    const where = folder({ "criada-minha.json": valid("criada-minha") });
    const edited = { ...JSON.parse(valid("criada-minha")), titulo: "Editada" };
    expect(replaceActivity(where, "criada-minha", edited)).toBe(true);
    const { themes } = loadActivities(where);
    expect(themes.map((theme) => theme.title)).toEqual(["Editada"]);
  });

  it("não cria arquivo novo ao substituir, nem mexe em atividades que não são criadas no painel", () => {
    const where = folder({ "boa.json": valid("boa") });
    const before = readFileSync(join(where, "boa.json"), "utf8");
    const other = { ...JSON.parse(valid("boa")), titulo: "Outra" };
    expect(replaceActivity(where, "criada-nao-existe", other)).toBe(false);
    expect(replaceActivity(where, "boa", other)).toBe(false);
    expect(readFileSync(join(where, "boa.json"), "utf8")).toBe(before);
    expect(readdirSync(where)).toEqual(["boa.json"]);
  });

  it("apaga o arquivo de uma atividade criada no painel", () => {
    const where = folder({ "criada-minha.json": valid("criada-minha") });
    expect(deleteActivity(where, "criada-minha")).toBe(true);
    expect(readdirSync(where)).toEqual([]);
    expect(deleteActivity(where, "criada-minha")).toBe(false);
  });

  it("nunca apaga uma atividade que não foi criada no painel, nem sai da pasta", () => {
    const where = folder({ "boa.json": valid("boa") });
    expect(deleteActivity(where, "boa")).toBe(false);
    expect(deleteActivity(where, "criada-../boa")).toBe(false);
    expect(deleteActivity(where, "../boa")).toBe(false);
    expect(readdirSync(where)).toEqual(["boa.json"]);
  });
});
