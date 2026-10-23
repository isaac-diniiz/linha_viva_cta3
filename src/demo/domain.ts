import type { PreviewState } from "../domain/preview";
import type { Theme } from "./activity";

export type { Theme, ThemeCard } from "./activity";

export type DemoStatus = "waiting" | "active" | "paused" | "ended";

/** Resposta do servidor a um código de turma errado; a tela do aluno pede outro. */
export const INVALID_CODE_MESSAGE = "Código da turma inválido.";
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
  teacherItemId: string;
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
  members: Record<string, string>;
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

export function createDemoState(
  theme: Theme,
  random: () => number = Math.random,
): DemoState {
  const ids = theme.cards.map((card) => card.id);
  const deck = theme.shuffle ? shuffled(ids, random) : ids;
  const teacherCard = theme.cards.find((card) => card.id === deck[0])!;
  return {
    code: "DEMO1234",
    theme,
    themeId: theme.id,
    title: theme.title,
    instruction: theme.instruction,
    axis: theme.axis,
    deck,
    items: [
      {
        id: teacherCard.id,
        label: teacherCard.label,
        templateId: teacherCard.id,
      },
    ],
    teacherItemId: teacherCard.id,
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
  const next = createDemoState(theme, random);
  next.code = state.code;
  for (const token of Object.keys(state.members)) assignStudent(next, token);
  return next;
}

export function assignStudent(state: DemoState, token: string): string {
  if (state.members[token]) return state.members[token];
  const { theme } = state;
  const turn =
    Object.keys(state.members).length + (theme.teacherCardReserved ? 1 : 0);
  const template = theme.cards.find(
    (card) => card.id === state.deck[turn % state.deck.length],
  )!;
  const id = crypto.randomUUID();
  state.items.push({ id, label: template.label, templateId: template.id });
  state.members[token] = id;
  return id;
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

export function confirmDemoMove(
  state: DemoState,
  token: string,
  x: number,
  expectedVersion: number,
  asTeacher = false,
): number {
  if (state.status !== "active")
    throw new Error(
      state.status === "waiting"
        ? "A sessão está aguardando o professor."
        : "Os movimentos estão pausados ou encerrados.",
    );
  const itemId = asTeacher ? state.teacherItemId : state.members[token];
  if (!itemId) throw new Error("Você não recebeu um item nesta sessão.");
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
