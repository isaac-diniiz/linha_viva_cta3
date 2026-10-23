import { describe, expect, it } from "vitest";
import { MAX_CARD_LENGTH, parseActivity } from "./activity";

function valid() {
  return {
    id: "ciclo-da-agua",
    disciplina: "Ciências",
    serie: "5º ano",
    titulo: "Ciclo da água",
    instrucao: "Organize as etapas do ciclo da água.",
    eixo: { inicio: "Início", fim: "Fim" },
    cartoes: [
      { id: "evaporacao", texto: "Evaporação", ordem: 1 },
      { id: "condensacao", texto: "Condensação", ordem: 2 },
      { id: "precipitacao", texto: "Precipitação", ordem: 3 },
    ],
  };
}

function errorsOf(raw: unknown): string[] {
  const result = parseActivity(raw);
  if (result.ok) throw new Error("A atividade deveria ser rejeitada.");
  return result.errors;
}

describe("cadastro de atividade em arquivo de dados", () => {
  it("aceita uma atividade completa e expõe disciplina, série e eixo", () => {
    const result = parseActivity(valid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme).toMatchObject({
      id: "ciclo-da-agua",
      subject: "Ciências",
      grade: "5º ano",
      title: "Ciclo da água",
      axis: { start: "Início", end: "Fim" },
      shuffle: false,
      teacherCardReserved: false,
    });
  });

  it("monta os cartões pela ordem declarada, não pela posição no arquivo", () => {
    const raw = valid();
    raw.cartoes.reverse();
    const result = parseActivity(raw);
    expect(result.ok && result.theme.cards.map((card) => card.id)).toEqual([
      "evaporacao",
      "condensacao",
      "precipitacao",
    ]);
  });

  it("guarda o ano opcional, usado só na revelação", () => {
    const raw = valid();
    Object.assign(raw.cartoes[0], { ano: 1500 });
    const result = parseActivity(raw);
    expect(result.ok && result.theme.cards[0].year).toBe(1500);
  });

  it("rejeita cartão sem ordem definida", () => {
    const raw = valid();
    delete (raw.cartoes[1] as { ordem?: number }).ordem;
    expect(errorsOf(raw).join("\n")).toMatch(/cartoes\[1\]\.ordem/);
  });

  it("rejeita ordem repetida ou com lacunas", () => {
    const repeated = valid();
    repeated.cartoes[2].ordem = 2;
    expect(errorsOf(repeated).join("\n")).toMatch(/ordem 2 repetida/);
    const gap = valid();
    gap.cartoes[2].ordem = 4;
    expect(errorsOf(gap).join("\n")).toMatch(/de 1 a 3/);
  });

  it("rejeita cartões duplicados, pelo id ou pelo texto", () => {
    const sameId = valid();
    sameId.cartoes[1].id = "evaporacao";
    expect(errorsOf(sameId).join("\n")).toMatch(/id "evaporacao" repetido/);
    const sameText = valid();
    sameText.cartoes[1].texto = "Evaporação";
    expect(errorsOf(sameText).join("\n")).toMatch(
      /texto "Evaporação" repetido/,
    );
  });

  it(`limita o texto do cartão a ${MAX_CARD_LENGTH} caracteres e recusa texto vazio`, () => {
    const long = valid();
    long.cartoes[0].texto = "a".repeat(MAX_CARD_LENGTH + 1);
    expect(errorsOf(long).join("\n")).toMatch(
      new RegExp(`cartoes\\[0\\]\\.texto.*${MAX_CARD_LENGTH}`),
    );
    const exact = valid();
    exact.cartoes[0].texto = "a".repeat(MAX_CARD_LENGTH);
    expect(parseActivity(exact).ok).toBe(true);
    const empty = valid();
    empty.cartoes[0].texto = "   ";
    expect(errorsOf(empty).join("\n")).toMatch(/cartoes\[0\]\.texto/);
  });

  it("exige ao menos três cartões e os campos de identificação", () => {
    const raw = valid() as Record<string, unknown>;
    raw.cartoes = (raw.cartoes as unknown[]).slice(0, 2);
    delete raw.serie;
    raw.disciplina = "";
    const errors = errorsOf(raw).join("\n");
    expect(errors).toMatch(/cartoes.*3/);
    expect(errors).toMatch(/serie/);
    expect(errors).toMatch(/disciplina/);
  });

  it("aponta campo desconhecido, para pegar erro de digitação", () => {
    const raw = { ...valid(), embaralar: true };
    expect(errorsOf(raw).join("\n")).toMatch(/embaralar/);
  });

  it("rejeita id fora do formato de endereço", () => {
    expect(errorsOf({ ...valid(), id: "Ciclo da Água" }).join("\n")).toMatch(
      /^id:/m,
    );
  });

  it("rejeita arquivo que não é um objeto", () => {
    expect(errorsOf([])).toHaveLength(1);
    expect(errorsOf(null)).toHaveLength(1);
  });
});
