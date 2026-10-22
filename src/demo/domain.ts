import type { PreviewState } from "../domain/preview";

export type DemoStatus = "waiting" | "active" | "paused" | "ended";
export type DemoState = {
  code: string;
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

export type ThemeCard = { id: string; label: string; year?: number };
export type Theme = {
  id: string;
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

export const themes: Record<string, Theme> = {
  "ciclo-da-agua": {
    id: "ciclo-da-agua",
    title: "Ciclo da água",
    instruction: "Organize as etapas do ciclo da água na sequência correta.",
    axis: { start: "Início", end: "Fim" },
    cards: [
      { id: "evaporacao", label: "Evaporação" },
      { id: "condensacao", label: "Condensação" },
      { id: "precipitacao", label: "Precipitação" },
    ],
    shuffle: false,
    teacherCardReserved: false,
  },
  historia: {
    id: "historia",
    title: "Linha do tempo do Brasil",
    instruction:
      "Cada um recebeu um acontecimento da história do Brasil, sem a data. Conversem e organizem a linha: o mais antigo à esquerda e o mais recente à direita.",
    axis: { start: "Mais antigo", end: "Mais recente" },
    cards: [
      { id: "cabral", label: "Chegada de Cabral ao Brasil", year: 1500 },
      {
        id: "salvador",
        label: "Fundação de Salvador, primeira capital",
        year: 1549,
      },
      { id: "zumbi", label: "Morte de Zumbi dos Palmares", year: 1695 },
      { id: "inconfidencia", label: "Inconfidência Mineira", year: 1789 },
      {
        id: "familia-real",
        label: "Chegada da família real portuguesa",
        year: 1808,
      },
      { id: "independencia", label: "Independência do Brasil", year: 1822 },
      { id: "lei-aurea", label: "Assinatura da Lei Áurea", year: 1888 },
      { id: "republica", label: "Proclamação da República", year: 1889 },
      { id: "brasilia", label: "Inauguração de Brasília", year: 1960 },
      {
        id: "constituicao",
        label: "Promulgação da Constituição Cidadã",
        year: 1988,
      },
    ],
    shuffle: true,
    teacherCardReserved: true,
  },
  "sistema-solar": {
    id: "sistema-solar",
    title: "Planetas do Sistema Solar",
    instruction:
      "Cada um recebeu um planeta. Conversem e organizem a linha do mais perto ao mais longe do Sol.",
    axis: { start: "Mais perto do Sol", end: "Mais longe do Sol" },
    cards: [
      { id: "mercurio", label: "Mercúrio" },
      { id: "venus", label: "Vênus" },
      { id: "terra", label: "Terra" },
      { id: "marte", label: "Marte" },
      { id: "jupiter", label: "Júpiter" },
      { id: "saturno", label: "Saturno" },
      { id: "urano", label: "Urano" },
      { id: "netuno", label: "Netuno" },
    ],
    shuffle: true,
    teacherCardReserved: true,
  },
  metamorfose: {
    id: "metamorfose",
    title: "Metamorfose da borboleta",
    instruction: "Organize as fases da vida da borboleta na sequência correta.",
    axis: { start: "Início", end: "Fim" },
    cards: [
      { id: "ovo", label: "Ovo" },
      { id: "lagarta", label: "Lagarta" },
      { id: "crisalida", label: "Crisálida" },
      { id: "borboleta", label: "Borboleta" },
    ],
    shuffle: true,
    teacherCardReserved: true,
  },
};

export const defaultThemeId = "ciclo-da-agua";

export type ThemeSummary = { id: string; title: string; cardCount: number };

/** Temas que o professor pode escolher, na ordem do menu. */
export function listThemes(): ThemeSummary[] {
  return Object.values(themes).map((theme) => ({
    id: theme.id,
    title: theme.title,
    cardCount: theme.cards.length,
  }));
}

export function themeById(id: string): Theme {
  const theme = themes[id];
  if (!theme) throw new Error(`Tema desconhecido: ${id}.`);
  return theme;
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
    label:
      themeById(state.themeId).cards.find((card) => card.id === id)?.label ??
      id,
    votes: groups.get(id)?.length ?? 0,
    total: state.items.filter((item) => item.templateId === id).length,
    marks: [...(groups.get(id) ?? [])].sort((a, b) => a - b),
  }));
}

/** Etapas da referência, uma por cartão, na ordem correta e com o ano quando houver. */
export function referenceLabels(state: DemoState): string[] {
  const present = new Set(state.items.map((item) => item.templateId));
  return themeById(state.themeId)
    .cards.filter((card) => present.has(card.id))
    .map((card) => (card.year ? `${card.label} (${card.year})` : card.label));
}

export function createDemoState(
  themeId: string = defaultThemeId,
  random: () => number = Math.random,
): DemoState {
  const theme = themeById(themeId);
  const ids = theme.cards.map((card) => card.id);
  const deck = theme.shuffle ? shuffled(ids, random) : ids;
  const teacherCard = theme.cards.find((card) => card.id === deck[0])!;
  return {
    code: "DEMO1234",
    themeId,
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
  themeId: string,
  random: () => number = Math.random,
): DemoState {
  if (state.status !== "waiting")
    throw new Error("O tema só pode ser trocado antes de iniciar a atividade.");
  const next = createDemoState(themeId, random);
  next.code = state.code;
  for (const token of Object.keys(state.members)) assignStudent(next, token);
  return next;
}

export function assignStudent(state: DemoState, token: string): string {
  if (state.members[token]) return state.members[token];
  const theme = themeById(state.themeId);
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
