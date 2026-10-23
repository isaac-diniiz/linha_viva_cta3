/** Texto máximo de um cartão, para caber legível no celular e na projeção. */
export const MAX_CARD_LENGTH = 60;
const MIN_CARDS = 3;
const MAX_CARDS = 40;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ThemeCard = { id: string; label: string; year?: number };
export type Theme = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  instruction: string;
  axis: { start: string; end: string };
  /** Cartões na ordem correta, do início ao fim do eixo. */
  cards: ThemeCard[];
  /** Embaralha a distribuição, para a ordem de entrada não entregar a resposta. */
  shuffle: boolean;
  /** O cartão do professor sai do baralho dos alunos até todos os outros serem usados. */
  teacherCardReserved: boolean;
};

export type ParseResult =
  { ok: true; theme: Theme } | { ok: false; errors: string[] };

type Fields = Record<string, unknown>;

function isObject(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownFields(
  value: Fields,
  allowed: string[],
  path: string,
  errors: string[],
) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      errors.push(`${path}${key}: campo desconhecido.`);
}

function text(
  value: unknown,
  path: string,
  max: number,
  errors: string[],
): string {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${path}: informe um texto.`);
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length > max)
    errors.push(`${path}: use no máximo ${max} caracteres.`);
  return trimmed;
}

function flag(value: unknown, path: string, errors: string[]): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") errors.push(`${path}: use true ou false.`);
  return value === true;
}

/**
 * Valida o arquivo de uma atividade e o converte no tema usado pela sessão.
 * Reúne todos os problemas encontrados, para corrigir o arquivo de uma vez.
 */
export function parseActivity(raw: unknown): ParseResult {
  if (!isObject(raw))
    return {
      ok: false,
      errors: ["A atividade deve ser um objeto JSON com chaves e valores."],
    };
  const errors: string[] = [];
  unknownFields(
    raw,
    [
      "id",
      "disciplina",
      "serie",
      "titulo",
      "instrucao",
      "eixo",
      "cartoes",
      "embaralhar",
      "reservarCartaoDoProfessor",
    ],
    "",
    errors,
  );
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!SLUG.test(id))
    errors.push(
      "id: use letras minúsculas sem acento, números e hífens, como ciclo-da-agua.",
    );
  const subject = text(raw.disciplina, "disciplina", 40, errors);
  const grade = text(raw.serie, "serie", 40, errors);
  const title = text(raw.titulo, "titulo", 120, errors);
  const instruction = text(raw.instrucao, "instrucao", 500, errors);

  const axis = { start: "", end: "" };
  if (!isObject(raw.eixo))
    errors.push('eixo: informe { "inicio": "...", "fim": "..." }.');
  else {
    unknownFields(raw.eixo, ["inicio", "fim"], "eixo.", errors);
    axis.start = text(raw.eixo.inicio, "eixo.inicio", 40, errors);
    axis.end = text(raw.eixo.fim, "eixo.fim", 40, errors);
  }

  const cards: (ThemeCard & { order: number })[] = [];
  if (!Array.isArray(raw.cartoes)) errors.push("cartoes: informe uma lista.");
  else {
    if (raw.cartoes.length < MIN_CARDS || raw.cartoes.length > MAX_CARDS)
      errors.push(
        `cartoes: use de ${MIN_CARDS} a ${MAX_CARDS} cartões (há ${raw.cartoes.length}).`,
      );
    const ids = new Set<string>();
    const labels = new Set<string>();
    const orders = new Set<number>();
    raw.cartoes.forEach((card: unknown, index) => {
      const path = `cartoes[${index}]`;
      if (!isObject(card)) {
        errors.push(`${path}: informe id, texto e ordem do cartão.`);
        return;
      }
      unknownFields(card, ["id", "texto", "ordem", "ano"], `${path}.`, errors);
      const cardId = typeof card.id === "string" ? card.id : "";
      if (!SLUG.test(cardId))
        errors.push(
          `${path}.id: use letras minúsculas sem acento, números e hífens.`,
        );
      else if (ids.has(cardId))
        errors.push(`${path}.id: id "${cardId}" repetido.`);
      ids.add(cardId);
      const label = text(card.texto, `${path}.texto`, MAX_CARD_LENGTH, errors);
      if (label && labels.has(label))
        errors.push(`${path}.texto: texto "${label}" repetido.`);
      labels.add(label);
      const order = card.ordem;
      if (typeof order !== "number" || !Number.isInteger(order))
        errors.push(`${path}.ordem: informe um número inteiro.`);
      else if (orders.has(order))
        errors.push(`${path}.ordem: ordem ${order} repetida.`);
      else orders.add(order);
      if (
        card.ano !== undefined &&
        (typeof card.ano !== "number" || !Number.isInteger(card.ano))
      )
        errors.push(`${path}.ano: informe um número inteiro.`);
      cards.push({
        id: cardId,
        label,
        order: typeof order === "number" ? order : 0,
        ...(typeof card.ano === "number" ? { year: card.ano } : {}),
      });
    });
    const expected = raw.cartoes.length;
    if (
      orders.size === expected &&
      [...orders].some((order) => order < 1 || order > expected)
    )
      errors.push(`cartoes: a ordem deve ir de 1 a ${expected}, sem lacunas.`);
  }

  const shuffle = flag(raw.embaralhar, "embaralhar", errors);
  const teacherCardReserved = flag(
    raw.reservarCartaoDoProfessor,
    "reservarCartaoDoProfessor",
    errors,
  );
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    theme: {
      id,
      subject,
      grade,
      title,
      instruction,
      axis,
      cards: cards
        .sort((a, b) => a.order - b.order)
        .map(({ id, label, year }) =>
          year === undefined ? { id, label } : { id, label, year },
        ),
      shuffle,
      teacherCardReserved,
    },
  };
}
