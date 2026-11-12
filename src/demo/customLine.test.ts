import { describe, expect, it } from "vitest";
import {
  createCustomActivity,
  isCustomLineId,
  lineFormOf,
  type CustomLineForm,
} from "./customLine";

const form = (overrides: Partial<CustomLineForm> = {}): CustomLineForm => ({
  titulo: "Linha do tempo da escola",
  inicio: "Mais antigo",
  fim: "Mais recente",
  cartoes: ["Fundação da escola", "Primeira reforma", "Nova biblioteca"],
  ...overrides,
});

function errorsOf(overrides: Partial<CustomLineForm>): string[] {
  const result = createCustomActivity(form(overrides), []);
  if (result.ok) throw new Error("era esperado um erro");
  return result.errors;
}

describe("criar uma linha pelo painel do professor", () => {
  it("monta a atividade com título, pontas do eixo e cartões na ordem digitada", () => {
    const result = createCustomActivity(form(), []);
    if (!result.ok) throw new Error(result.errors.join("; "));
    const { theme } = result;
    expect(theme.title).toBe("Linha do tempo da escola");
    expect(theme.axis).toEqual({ start: "Mais antigo", end: "Mais recente" });
    expect(theme.cards.map((card) => card.label)).toEqual([
      "Fundação da escola",
      "Primeira reforma",
      "Nova biblioteca",
    ]);
    expect(new Set(theme.cards.map((card) => card.id)).size).toBe(3);
  });

  it("gera um id válido e sem acentos a partir do título", () => {
    const result = createCustomActivity(
      form({ titulo: "Revolução Francesa!" }),
      [],
    );
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.theme.id).toBe("criada-revolucao-francesa");
    expect(result.raw).toMatchObject({ id: "criada-revolucao-francesa" });
  });

  it("não repete o id de uma atividade que já existe", () => {
    const taken = ["criada-linha-do-tempo-da-escola"];
    const second = createCustomActivity(form(), taken);
    if (!second.ok) throw new Error(second.errors.join("; "));
    expect(second.theme.id).toBe("criada-linha-do-tempo-da-escola-2");
    const third = createCustomActivity(form(), [
      ...taken,
      "criada-linha-do-tempo-da-escola-2",
    ]);
    if (!third.ok) throw new Error(third.errors.join("; "));
    expect(third.theme.id).toBe("criada-linha-do-tempo-da-escola-3");
  });

  it("usa um id padrão quando o título só tem símbolos", () => {
    const result = createCustomActivity(form({ titulo: "???" }), []);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.theme.id).toBe("criada-linha");
  });

  it("agrupa em Minhas linhas quando não há disciplina nem série", () => {
    const result = createCustomActivity(form(), []);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.theme.subject).toBe("Minhas linhas");
    expect(result.theme.grade).toBe("Livre");
    const custom = createCustomActivity(
      form({ disciplina: " Geografia ", serie: "6º ano" }),
      [],
    );
    if (!custom.ok) throw new Error(custom.errors.join("; "));
    expect(custom.theme.subject).toBe("Geografia");
    expect(custom.theme.grade).toBe("6º ano");
  });

  it("escreve a instrução dos alunos com as duas pontas quando o professor não escreve", () => {
    const result = createCustomActivity(form(), []);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.theme.instruction).toContain("Mais antigo");
    expect(result.theme.instruction).toContain("Mais recente");
    expect(result.theme.instruction).toMatch(/esquerda/);
    expect(result.theme.instruction).toMatch(/direita/);
    const custom = createCustomActivity(
      form({ instrucao: "Ordenem do mais velho ao mais novo." }),
      [],
    );
    if (!custom.ok) throw new Error(custom.errors.join("; "));
    expect(custom.theme.instruction).toBe(
      "Ordenem do mais velho ao mais novo.",
    );
  });

  it("embaralha e reserva o cartão do professor só quando pedido", () => {
    const plain = createCustomActivity(form(), []);
    const shuffled = createCustomActivity(form({ embaralhar: true }), []);
    if (!plain.ok || !shuffled.ok) throw new Error("era esperado sucesso");
    expect(plain.theme.shuffle).toBe(false);
    expect(plain.theme.teacherCardReserved).toBe(false);
    expect(shuffled.theme.shuffle).toBe(true);
    expect(shuffled.theme.teacherCardReserved).toBe(true);
  });

  it("remove espaços sobrando do tema, das pontas e dos cartões", () => {
    const result = createCustomActivity(
      form({
        titulo: "  Tema  ",
        inicio: " Antes ",
        fim: " Depois ",
        cartoes: [" A ", "B ", " C"],
      }),
      [],
    );
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.theme.title).toBe("Tema");
    expect(result.theme.axis).toEqual({ start: "Antes", end: "Depois" });
    expect(result.theme.cards.map((card) => card.label)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("aceita de 3 a 40 cartões e explica quando o número é outro", () => {
    const many = Array.from(
      { length: 40 },
      (_, index) => `Cartão ${index + 1}`,
    );
    expect(createCustomActivity(form({ cartoes: many }), []).ok).toBe(true);
    expect(errorsOf({ cartoes: ["A", "B"] })).toContain(
      "Use de 3 a 40 cartões (há 2).",
    );
    expect(errorsOf({ cartoes: [...many, "Extra"] })).toContain(
      "Use de 3 a 40 cartões (há 41).",
    );
  });

  it("pede o tema e as duas pontas, em português claro", () => {
    expect(errorsOf({ titulo: "  " })).toContain(
      "Dê um nome ao tema da linha.",
    );
    expect(errorsOf({ inicio: "" })).toContain(
      "Escreva o que fica na ponta da esquerda.",
    );
    expect(errorsOf({ fim: " " })).toContain(
      "Escreva o que fica na ponta da direita.",
    );
  });

  it("aponta o cartão vazio pela posição", () => {
    expect(errorsOf({ cartoes: ["A", "", "C"] })).toContain(
      "O cartão 2 está vazio.",
    );
  });

  it("recusa texto de cartão acima de 60 caracteres", () => {
    expect(errorsOf({ cartoes: ["A", "B".repeat(61), "C"] })).toContain(
      "O cartão 2 passa de 60 caracteres (tem 61).",
    );
  });

  it("recusa cartões com o mesmo texto, sem diferenciar maiúsculas", () => {
    expect(errorsOf({ cartoes: ["Lua", "Sol", "lua"] })).toContain(
      "Os cartões 1 e 3 têm o mesmo texto.",
    );
  });

  it("limita o tamanho do tema e das pontas", () => {
    expect(errorsOf({ titulo: "T".repeat(121) })).toContain(
      "O tema pode ter no máximo 120 caracteres.",
    );
    expect(errorsOf({ inicio: "I".repeat(41) })).toContain(
      "A ponta da esquerda pode ter no máximo 40 caracteres.",
    );
    expect(errorsOf({ fim: "F".repeat(41) })).toContain(
      "A ponta da direita pode ter no máximo 40 caracteres.",
    );
  });

  it("reúne todos os problemas de uma vez", () => {
    const errors = errorsOf({
      titulo: "",
      inicio: "",
      fim: "",
      cartoes: ["A", ""],
    });
    expect(errors.length >= 4).toBe(true);
  });

  it("só reconhece como linha criada no painel os ids que começam com criada-", () => {
    expect(isCustomLineId("criada-fases-da-escola")).toBe(true);
    expect(isCustomLineId("criada-linha-2")).toBe(true);
    expect(isCustomLineId("ciclo-da-agua")).toBe(false);
    expect(isCustomLineId("criada-")).toBe(false);
    expect(isCustomLineId("criada-../segredo")).toBe(false);
    expect(isCustomLineId("criada-A")).toBe(false);
  });

  it("mantém o id da linha ao editar, mesmo que o título mude", () => {
    const edited = createCustomActivity(
      form({ titulo: "Outro nome" }),
      ["criada-fases"],
      "criada-fases",
    );
    if (!edited.ok) throw new Error(edited.errors.join("; "));
    expect(edited.theme.id).toBe("criada-fases");
    expect(edited.theme.title).toBe("Outro nome");
  });

  it("devolve ao formulário exatamente o que o professor tinha digitado", () => {
    const original = form({
      disciplina: "Geografia",
      serie: "6º ano",
      instrucao: "Ordenem do menor ao maior.",
      embaralhar: true,
    });
    const created = createCustomActivity(original, []);
    if (!created.ok) throw new Error(created.errors.join("; "));
    expect(lineFormOf(created.theme)).toEqual(original);
  });

  it("não trata a instrução escrita automaticamente como se fosse do professor", () => {
    const created = createCustomActivity(form(), []);
    if (!created.ok) throw new Error(created.errors.join("; "));
    const back = lineFormOf(created.theme);
    expect(back.instrucao).toBeUndefined();
    // ao trocar as pontas, a instrução automática acompanha
    const edited = createCustomActivity({ ...back, fim: "Hoje" }, []);
    if (!edited.ok) throw new Error(edited.errors.join("; "));
    expect(edited.theme.instruction).toContain("Hoje");
  });

  it("não devolve Minhas linhas e Livre como se o professor os tivesse escrito", () => {
    const created = createCustomActivity(form(), []);
    if (!created.ok) throw new Error(created.errors.join("; "));
    const back = lineFormOf(created.theme);
    expect(back.disciplina).toBeUndefined();
    expect(back.serie).toBeUndefined();
  });
});
