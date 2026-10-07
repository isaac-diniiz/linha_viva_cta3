import type { PreviewState } from "../domain/preview";

export type DemoStatus = "waiting" | "active" | "paused" | "ended";
export type DemoState = {
  code: string;
  title: string;
  instruction: string;
  items: { id: string; label: string; templateId: string }[];
  teacherItemId: string;
  confirmedOrder: string[];
  confirmedPositions: Record<string, number>;
  status: DemoStatus;
  version: number;
  previewVersionFloor: number;
  revealed: boolean;
  members: Record<string, string>;
  previews: PreviewState;
};

const cardTemplates = [
  { id: "evaporacao", label: "Evaporação" },
  { id: "condensacao", label: "Condensação" },
  { id: "precipitacao", label: "Precipitação" },
];

export function createDemoState(): DemoState {
  return {
    code: "DEMO1234",
    title: "Ciclo da água",
    instruction: "Organize as etapas do ciclo da água na sequência correta.",
    items: [{ ...cardTemplates[0], templateId: cardTemplates[0].id }],
    teacherItemId: cardTemplates[0].id,
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

export function assignStudent(state: DemoState, token: string): string {
  if (state.members[token]) return state.members[token];
  const template =
    cardTemplates[Object.keys(state.members).length % cardTemplates.length];
  const id = crypto.randomUUID();
  state.items.push({ id, label: template.label, templateId: template.id });
  state.members[token] = id;
  return id;
}

export function setDemoStatus(state: DemoState, status: DemoStatus): void {
  if (state.status === "ended") throw new Error("A sessão foi encerrada.");
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
  state.confirmedPositions[itemId] = x;
  state.confirmedOrder = Object.keys(state.confirmedPositions).sort(
    (a, b) =>
      state.confirmedPositions[a] - state.confirmedPositions[b] ||
      a.localeCompare(b),
  );
  state.version++;
  delete state.previews[itemId];
  return state.version;
}
