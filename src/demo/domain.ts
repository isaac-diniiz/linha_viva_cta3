import type { PreviewState } from "../domain/preview";
import type { Theme } from "./activity";

export type { Theme, ThemeCard } from "./activity";

export type DemoStatus = "waiting" | "active" | "paused" | "ended";

/** Resposta do servidor a um código de turma errado; a tela do aluno pede outro. */
export const INVALID_CODE_MESSAGE = "Código da turma inválido.";

/** Teto de cartões por participante, para turmas pequenas cobrirem a linha toda. */
export const MAX_CARDS_PER_PARTICIPANT = 4;

export type DemoState = {
  code: string;
  /** Tema completo, com a ordem correta; nunca enviado inteiro aos clientes. */
  theme: Theme;
  themeId: string;
  title: string;
  instruction: string;
  axis: { start: string; end: string };
  /** Ordem em que os cartões são entregues aos alunos (ids de cartão). */
  deck: string[];
  items: { id: string; label: string; templateId: string }[];
  /** Quantos cartões cada participante, professor incluído, recebe. */
  cardsPerParticipant: number;
  teacherItemIds: string[];
  /** Voto de cada ocorrência (id do item) na linha, entre 0 e 1. */
  votes: Record<string, number>;
  /** Ordem das caixas da linha: uma por cartão (templateId), não por aluno. */
  confirmedOrder: string[];
  /** Posição de consenso de cada caixa da linha, indexada por templateId. */
  confirmedPositions: Record<string, number>;
  status: DemoStatus;
  version: number;
  previewVersionFloor: number;
  revealed: boolean;
  /** Cartões (ids de item) de cada aluno, pela identidade temporária. */
  members: Record<string, string[]>;
  previews: PreviewState;
};

export type ThemeSummary = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  cardCount: number;
};

/** Atividades que o professor pode escolher, sem a ordem correta dos cartões. */
export function listThemes(themes: Theme[]): ThemeSummary[] {
  return themes.map((theme) => ({
    id: theme.id,
    title: theme.title,
    subject: theme.subject,
    grade: theme.grade,
    cardCount: theme.cards.length,
  }));
}

function shuffled<T>(list: T[], random: () => number): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type LineCard = {
  id: string;
  label: string;
  votes: number;
  total: number;
  marks: number[];
};

/** Consenso dos votos: a mediana, que não se deixa arrastar por um voto isolado. */
export function consensusPosition(votes: number[]): number {
  if (votes.length === 0) throw new Error("Nenhum voto para calcular.");
  const sorted = [...votes].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function votesByTemplate(state: DemoState): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const item of state.items) {
    const vote = state.votes[item.id];
    if (vote === undefined) continue;
    groups.set(item.templateId, [...(groups.get(item.templateId) ?? []), vote]);
  }
  return groups;
}

function recomputeLine(state: DemoState): void {
  const positions: Record<string, number> = {};
  for (const [templateId, votes] of votesByTemplate(state))
    positions[templateId] = consensusPosition(votes);
  state.confirmedPositions = positions;
  state.confirmedOrder = Object.keys(positions).sort(
    (a, b) => positions[a] - positions[b] || a.localeCompare(b),
  );
}

/** Caixas da linha com a contagem de votos, sem identificar quem votou. */
export function lineCards(state: DemoState): LineCard[] {
  const groups = votesByTemplate(state);
  return state.confirmedOrder.map((id) => ({
    id,
    label: state.theme.cards.find((card) => card.id === id)?.label ?? id,
    votes: groups.get(id)?.length ?? 0,
    total: state.items.filter((item) => item.templateId === id).length,
    marks: [...(groups.get(id) ?? [])].sort((a, b) => a - b),
  }));
}

/** Etapas da referência, uma por cartão, na ordem correta e com o ano quando houver. */
export function referenceLabels(state: DemoState): string[] {
  const present = new Set(state.items.map((item) => item.templateId));
  return state.theme.cards
    .filter((card) => present.has(card.id))
    .map((card) => (card.year ? `${card.label} (${card.year})` : card.label));
}

/** Cartões por pessoa de fato entregues: ninguém recebe o mesmo cartão duas vezes. */
function handSize(state: Pick<DemoState, "cardsPerParticipant" | "deck">) {
  return Math.min(state.cardsPerParticipant, state.deck.length);
}

function cardAt(state: Pick<DemoState, "theme" | "deck">, position: number) {
  const id = state.deck[position % state.deck.length];
  return state.theme.cards.find((card) => card.id === id)!;
}

export function createDemoState(
  theme: Theme,
  random: () => number = Math.random,
  cardsPerParticipant = 1,
): DemoState {
  const ids = theme.cards.map((card) => card.id);
  const deck = theme.shuffle ? shuffled(ids, random) : ids;
  const hand = Math.min(cardsPerParticipant, deck.length);
  // o professor recebe o início do baralho; os ids dos seus itens são os do cartão
  const teacherCards = Array.from({ length: hand }, (_, index) =>
    cardAt({ theme, deck }, index),
  );
  return {
    code: "DEMO1234",
    theme,
    themeId: theme.id,
    title: theme.title,
    instruction: theme.instruction,
    axis: theme.axis,
    deck,
    items: teacherCards.map((card) => ({
      id: card.id,
      label: card.label,
      templateId: card.id,
    })),
    cardsPerParticipant,
    teacherItemIds: teacherCards.map((card) => card.id),
    votes: {},
    confirmedOrder: [],
    confirmedPositions: {},
    status: "waiting",
    version: 0,
    previewVersionFloor: 0,
    revealed: false,
    members: {},
    previews: {},
  };
}

/**
 * Novo estado com outro tema, no mesmo código de turma, reatribuindo cartões
 * aos alunos que já entraram. Só vale antes de a atividade começar.
 */
export function changeTheme(
  state: DemoState,
  theme: Theme,
  random: () => number = Math.random,
): DemoState {
  if (state.status !== "waiting")
    throw new Error("O tema só pode ser trocado antes de iniciar a atividade.");
  return redeal(state, theme, state.cardsPerParticipant, random);
}

/**
 * Muda quantos cartões cada participante recebe, no mesmo código de turma,
 * reatribuindo os cartões de quem já entrou. Só vale antes de a atividade começar.
 */
export function setCardsPerParticipant(
  state: DemoState,
  count: number,
  random: () => number = Math.random,
): DemoState {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_CARDS_PER_PARTICIPANT
  )
    throw new Error(
      `Escolha de 1 a ${MAX_CARDS_PER_PARTICIPANT} cartões por participante.`,
    );
  if (state.status !== "waiting")
    throw new Error(
      "A quantidade de cartões só pode mudar antes de iniciar a atividade.",
    );
  return redeal(state, state.theme, count, random);
}

function redeal(
  state: DemoState,
  theme: Theme,
  cardsPerParticipant: number,
  random: () => number,
): DemoState {
  const next = createDemoState(theme, random, cardsPerParticipant);
  next.code = state.code;
  for (const token of Object.keys(state.members)) assignStudent(next, token);
  return next;
}

/**
 * Entrega os cartões de um aluno, seguindo o baralho a partir do último entregue.
 * Com o cartão do professor reservado, os alunos começam depois da mão dele.
 */
export function assignStudent(state: DemoState, token: string): string[] {
  if (state.members[token]) return state.members[token];
  const hand = handSize(state);
  const handed = Object.values(state.members).reduce(
    (total, ids) => total + ids.length,
    0,
  );
  const start = (state.theme.teacherCardReserved ? hand : 0) + handed;
  const ids = Array.from({ length: hand }, (_, index) => {
    const card = cardAt(state, start + index);
    const id = crypto.randomUUID();
    state.items.push({ id, label: card.label, templateId: card.id });
    return id;
  });
  state.members[token] = ids;
  return ids;
}

/** Cartões que o professor ou um aluno pode mover. */
export function ownedItems(
  state: DemoState,
  token: string,
  asTeacher = false,
): string[] {
  return asTeacher ? state.teacherItemIds : (state.members[token] ?? []);
}

/**
 * Confere que o cartão pertence a quem pediu. Com um único cartão, o id pode
 * ser omitido; com mais de um, é preciso dizer qual.
 */
export function resolveOwnItem(
  state: DemoState,
  token: string,
  itemId?: string,
  asTeacher = false,
): string {
  const owned = ownedItems(state, token, asTeacher);
  if (owned.length === 0)
    throw new Error("Você não recebeu um item nesta sessão.");
  if (itemId === undefined) {
    if (owned.length > 1) throw new Error("Escolha qual cartão confirmar.");
    return owned[0];
  }
  if (!owned.includes(itemId)) throw new Error("Esse cartão não é seu.");
  return itemId;
}

export function setDemoStatus(state: DemoState, status: DemoStatus): void {
  if (state.status === "ended") throw new Error("A sessão foi encerrada.");
  if (state.status === status)
    throw new Error("A atividade já está nesse estado.");
  if (status === "paused" && state.status === "waiting")
    throw new Error("A atividade ainda não começou.");
  state.status = status;
  state.version++;
  state.previewVersionFloor = state.version;
  state.previews = {};
}

export function canAcceptDemoPreview(
  state: Pick<DemoState, "status" | "version" | "previewVersionFloor">,
  previewVersion: number,
): boolean {
  return (
    state.status === "active" &&
    Number.isInteger(previewVersion) &&
    previewVersion >= state.previewVersionFloor &&
    previewVersion <= state.version
  );
}

export type ConfirmOptions = { itemId?: string; asTeacher?: boolean };

export function confirmDemoMove(
  state: DemoState,
  token: string,
  x: number,
  expectedVersion: number,
  { itemId: requested, asTeacher = false }: ConfirmOptions = {},
): number {
  if (state.status !== "active")
    throw new Error(
      state.status === "waiting"
        ? "A sessão está aguardando o professor."
        : "Os movimentos estão pausados ou encerrados.",
    );
  const itemId = resolveOwnItem(state, token, requested, asTeacher);
  if (state.version !== expectedVersion)
    throw new Error("A versão da linha mudou. Confira e tente novamente.");
  if (!Number.isFinite(x) || x < 0 || x > 1)
    throw new Error("Posição inválida.");
  state.votes[itemId] = x;
  recomputeLine(state);
  state.version++;
  delete state.previews[itemId];
  return state.version;
}
