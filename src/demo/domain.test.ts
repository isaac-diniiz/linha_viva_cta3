import { describe, expect, it } from "vitest";
import {
  assignStudent,
  canAcceptDemoPreview,
  confirmDemoMove,
  createDemoState,
  setDemoStatus,
} from "./domain";

describe("demonstração na rede local", () => {
  it("mantém a prévia de outro arraste após uma confirmação concorrente e bloqueia gesto de antes da pausa", () => {
    const state = createDemoState();
    assignStudent(state, "aluno-a");
    assignStudent(state, "aluno-b");
    setDemoStatus(state, "active");
    const dragVersion = state.version;
    confirmDemoMove(state, "aluno-a", 0.2, dragVersion);
    expect(canAcceptDemoPreview(state, dragVersion)).toBe(true);
    setDemoStatus(state, "paused");
    setDemoStatus(state, "active");
    expect(canAcceptDemoPreview(state, dragVersion)).toBe(false);
    expect(canAcceptDemoPreview(state, state.version)).toBe(true);
  });
  it("distribui os três cartões em sequência antes de repetir para alunos seguintes", () => {
    const state = createDemoState();
    const tokens = ["joao1", "joao2", "joao3", "maria", "ana", "bia", "caio"];
    const assigned = tokens.map((token) => assignStudent(state, token));
    expect(
      assigned.map((id) => state.items.find((item) => item.id === id)?.label),
    ).toEqual([
      "Evaporação",
      "Condensação",
      "Precipitação",
      "Evaporação",
      "Condensação",
      "Precipitação",
      "Evaporação",
    ]);
    expect(new Set([state.teacherItemId, ...assigned]).size).toBe(8);
    expect(assignStudent(state, "maria")).toBe(assigned[3]);
    expect(state.items).toHaveLength(8);
  });

  it("conta separadamente cartões repetidos confirmados na linha", () => {
    const state = createDemoState();
    const assigned = ["a", "b", "c", "d"].map((token) =>
      assignStudent(state, token),
    );
    setDemoStatus(state, "active");
    assigned.forEach((_, index) =>
      confirmDemoMove(state, ["a", "b", "c", "d"][index], index / 5, index + 1),
    );
    expect(state.confirmedOrder).toHaveLength(4);
    expect(new Set(state.confirmedOrder).size).toBe(4);
    expect(state.items).toHaveLength(5);
  });
  it("atribui um item por identidade e conserva a atribuição na reconexão", () => {
    const state = createDemoState();
    const first = assignStudent(state, "celular-a");
    expect(assignStudent(state, "celular-a")).toBe(first);
    expect(assignStudent(state, "celular-b")).not.toBe(first);
  });

  it("só confirma o item de um aluno em sessão ativa e com versão atual", () => {
    const state = createDemoState();
    const id = assignStudent(state, "celular-a");
    expect(() => confirmDemoMove(state, "celular-a", 0.5, 0)).toThrow(
      /aguardando/,
    );
    setDemoStatus(state, "active");
    expect(() => confirmDemoMove(state, "intruso", 0.5, 1)).toThrow(/item/);
    expect(confirmDemoMove(state, "celular-a", 0.5, 1)).toBe(2);
    expect(state.confirmedOrder).toEqual([id]);
    expect(() => confirmDemoMove(state, "celular-a", 0.8, 1)).toThrow(/versão/);
  });

  it("guarda a coordenada solta e ordena os itens pelas posições na linha", () => {
    const state = createDemoState();
    const first = assignStudent(state, "celular-a");
    const second = assignStudent(state, "celular-b");
    setDemoStatus(state, "active");
    confirmDemoMove(state, "celular-a", 0.1, 1);
    expect(state.confirmedPositions).toEqual({ [first]: 0.1 });
    confirmDemoMove(state, "celular-b", 0.3, 2);
    expect(state.confirmedOrder).toEqual([first, second]);
    confirmDemoMove(state, "celular-a", 0.9, 3);
    expect(state.confirmedOrder).toEqual([second, first]);
    expect(state.confirmedPositions).toEqual({
      [first]: 0.9,
      [second]: 0.3,
    });
  });
});
