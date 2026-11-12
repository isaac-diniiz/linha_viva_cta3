import {
  MAX_CARDS,
  MAX_CARD_LENGTH,
  MIN_CARDS,
  parseActivity,
  type Theme,
} from "./activity";

/** Prefixo do id das linhas criadas no painel; só elas podem ser editadas ou apagadas. */
const CUSTOM_ID_PREFIX = "criada-";
const CUSTOM_ID = /^criada-[a-z0-9]+(-[a-z0-9]+)*$/;

/** O que o professor preenche no painel para criar uma linha. */
export type CustomLineForm = {
  titulo: string;
  /** Ponta da esquerda do eixo. */
  inicio: string;
  /** Ponta da direita do eixo. */
  fim: string;
  /** Textos dos cartões, na ordem correta, da esquerda para a direita. */
  cartoes: string[];
  disciplina?: string;
  serie?: string;
  instrucao?: string;
  embaralhar?: boolean;
};

/** Linha criada no painel, como o professor a escreveu, para voltar ao formulário. */
export type CustomLineEntry = CustomLineForm & { id: string };

export type CustomLineResult =
  | { ok: true; theme: Theme; raw: Record<string, unknown> }
  | { ok: false; errors: string[] };

export const DEFAULT_SUBJECT = "Minhas linhas";
export const DEFAULT_GRADE = "Livre";

const MAX_TITLE = 120;
const MAX_AXIS = 40;
const MAX_FIELD = 40;
const MAX_INSTRUCTION = 500;
const MAX_ID_SLUG = 40;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** "Revolução Francesa!" → "revolucao-francesa". */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_SLUG)
    .replace(/-+$/g, "");
}

function defaultInstruction(start: string, end: string): string {
  return `Organize os cartões na linha: "${start}" na ponta da esquerda e "${end}" na ponta da direita.`;
}

/** Só os ids `criada-…` vêm do painel; os demais são atividades prontas, que não se mexe. */
export function isCustomLineId(id: unknown): id is string {
  return typeof id === "string" && CUSTOM_ID.test(id);
}

/**
 * Devolve ao formulário o que o professor tinha escrito. Disciplina, série e
 * instrução que o sistema preencheu sozinho ficam de fora, para que continuem
 * automáticos (a instrução, por exemplo, acompanha as pontas se elas mudarem).
 */
export function lineFormOf(theme: Theme): CustomLineForm {
  const form: CustomLineForm = {
    titulo: theme.title,
    inicio: theme.axis.start,
    fim: theme.axis.end,
    cartoes: theme.cards.map((card) => card.label),
    embaralhar: theme.shuffle,
  };
  if (theme.subject !== DEFAULT_SUBJECT) form.disciplina = theme.subject;
  if (theme.grade !== DEFAULT_GRADE) form.serie = theme.grade;
  if (theme.instruction !== defaultInstruction(form.inicio, form.fim))
    form.instrucao = theme.instruction;
  return form;
}

function uniqueId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

function listPositions(positions: number[]): string {
  if (positions.length === 1) return String(positions[0]);
  return `${positions.slice(0, -1).join(", ")} e ${positions.at(-1)}`;
}

/**
 * Valida o formulário do professor e o converte numa atividade, no mesmo formato
 * dos arquivos de `atividades/`. Aceita qualquer valor vindo da rede e devolve
 * todos os problemas de uma vez, em linguagem para o professor.
 */
export function createCustomActivity(
  input: unknown,
  takenIds: string[],
  /** Ao editar, a linha mantém o id (e o arquivo), mesmo que o título mude. */
  fixedId?: string,
): CustomLineResult {
  const form = (typeof input === "object" && input !== null ? input : {}) as {
    [key: string]: unknown;
  };
  const title = str(form.titulo);
  const start = str(form.inicio);
  const end = str(form.fim);
  const subject = str(form.disciplina) || DEFAULT_SUBJECT;
  const grade = str(form.serie) || DEFAULT_GRADE;
  const shuffle = form.embaralhar === true;
  const cards = Array.isArray(form.cartoes) ? form.cartoes.map(str) : [];
  const errors: string[] = [];

  if (!title) errors.push("Dê um nome ao tema da linha.");
  else if (title.length > MAX_TITLE)
    errors.push(`O tema pode ter no máximo ${MAX_TITLE} caracteres.`);
  if (!start) errors.push("Escreva o que fica na ponta da esquerda.");
  else if (start.length > MAX_AXIS)
    errors.push(
      `A ponta da esquerda pode ter no máximo ${MAX_AXIS} caracteres.`,
    );
  if (!end) errors.push("Escreva o que fica na ponta da direita.");
  else if (end.length > MAX_AXIS)
    errors.push(
      `A ponta da direita pode ter no máximo ${MAX_AXIS} caracteres.`,
    );
  if (subject.length > MAX_FIELD)
    errors.push(`A disciplina pode ter no máximo ${MAX_FIELD} caracteres.`);
  if (grade.length > MAX_FIELD)
    errors.push(`A série pode ter no máximo ${MAX_FIELD} caracteres.`);
  const customInstruction = str(form.instrucao);
  if (customInstruction.length > MAX_INSTRUCTION)
    errors.push(
      `A instrução pode ter no máximo ${MAX_INSTRUCTION} caracteres.`,
    );

  if (cards.length < MIN_CARDS || cards.length > MAX_CARDS)
    errors.push(
      `Use de ${MIN_CARDS} a ${MAX_CARDS} cartões (há ${cards.length}).`,
    );
  const positionsByText = new Map<string, number[]>();
  cards.forEach((text, index) => {
    const position = index + 1;
    if (!text) errors.push(`O cartão ${position} está vazio.`);
    else {
      if (text.length > MAX_CARD_LENGTH)
        errors.push(
          `O cartão ${position} passa de ${MAX_CARD_LENGTH} caracteres (tem ${text.length}).`,
        );
      const key = text.toLocaleLowerCase("pt-BR");
      positionsByText.set(key, [...(positionsByText.get(key) ?? []), position]);
    }
  });
  for (const positions of positionsByText.values())
    if (positions.length > 1)
      errors.push(`Os cartões ${listPositions(positions)} têm o mesmo texto.`);
  if (errors.length) return { ok: false, errors };

  const raw = {
    id:
      fixedId ??
      uniqueId(`${CUSTOM_ID_PREFIX}${slugify(title) || "linha"}`, takenIds),
    disciplina: subject,
    serie: grade,
    titulo: title,
    instrucao: customInstruction || defaultInstruction(start, end),
    eixo: { inicio: start, fim: end },
    embaralhar: shuffle,
    reservarCartaoDoProfessor: shuffle,
    cartoes: cards.map((texto, index) => ({
      id: `c${index + 1}`,
      texto,
      ordem: index + 1,
    })),
  };
  // rede de segurança: o formato final é o mesmo validado nos arquivos
  const parsed = parseActivity(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return { ok: true, theme: parsed.theme, raw };
}
