import { describe, expect, it } from "vitest";
import {
  assignStudent,
  canAcceptDemoPreview,
  changeTheme,
  confirmDemoMove,
  consensusPosition,
  createDemoState,
  lineCards,
  listThemes,
  referenceLabels,
  setDemoStatus,
  themes,
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

  it("mostra uma única caixa na linha para cartões repetidos, com a posição votada pelos alunos", () => {
    const state = createDemoState();
    const tokens = ["a", "b", "c", "d"];
    tokens.forEach((token) => assignStudent(state, token));
    setDemoStatus(state, "active");
    // a e d têm Evaporação; b, Condensação; c, Precipitação
    confirmDemoMove(state, "a", 0.1, state.version);
    confirmDemoMove(state, "b", 0.5, state.version);
    confirmDemoMove(state, "c", 0.9, state.version);
    confirmDemoMove(state, "d", 0.3, state.version);
    expect(state.confirmedOrder).toEqual([
      "evaporacao",
      "condensacao",
      "precipitacao",
    ]);
    expect(state.confirmedPositions.evaporacao).toBeCloseTo(0.2);
  });

  it("usa a mediana dos votos como consenso, resistindo a um voto fora do padrão", () => {
    expect(consensusPosition([0.1, 0.2, 0.9])).toBe(0.2);
    expect(consensusPosition([0.4, 0.2])).toBeCloseTo(0.3);
    expect(consensusPosition([0.7])).toBe(0.7);
    expect(() => consensusPosition([])).toThrow();
  });

  it("recalcula o consenso quando um aluno muda seu voto", () => {
    const state = createDemoState();
    ["a", "b", "c", "d"].forEach((token) => assignStudent(state, token));
    setDemoStatus(state, "active");
    confirmDemoMove(state, "a", 0.1, state.version);
    confirmDemoMove(state, "d", 0.5, state.version);
    expect(state.confirmedPositions.evaporacao).toBeCloseTo(0.3);
    confirmDemoMove(state, "d", 0.1, state.version);
    expect(state.confirmedPositions.evaporacao).toBeCloseTo(0.1);
    expect(state.confirmedOrder).toEqual(["evaporacao"]);
  });

  it("conta votos e participantes de cada cartão sem identificar quem votou", () => {
    const state = createDemoState();
    ["a", "b", "c", "d"].forEach((token) => assignStudent(state, token));
    setDemoStatus(state, "active");
    confirmDemoMove(state, "a", 0.1, state.version);
    confirmDemoMove(state, "d", 0.3, state.version);
    confirmDemoMove(state, "b", 0.6, state.version);
    expect(lineCards(state)).toEqual([
      {
        id: "evaporacao",
        label: "Evaporação",
        votes: 2,
        // dois alunos mais o cartão do professor
        total: 3,
        marks: [0.1, 0.3],
      },
      {
        id: "condensacao",
        label: "Condensação",
        votes: 1,
        total: 1,
        marks: [0.6],
      },
    ]);
  });

  it("não deixa cartões do professor e do aluno aparecerem repetidos na referência", () => {
    const state = createDemoState();
    ["a", "b", "c", "d", "e"].forEach((token) => assignStudent(state, token));
    expect(referenceLabels(state)).toEqual([
      "Evaporação",
      "Condensação",
      "Precipitação",
    ]);
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
    expect(id).toBeTruthy();
    expect(state.confirmedOrder).toEqual(["evaporacao"]);
    expect(() => confirmDemoMove(state, "celular-a", 0.8, 1)).toThrow(/versão/);
  });

  describe("estados da sessão", () => {
    it("não pausa uma atividade que ainda não começou", () => {
      const state = createDemoState();
      expect(() => setDemoStatus(state, "paused")).toThrow(/não começou/);
      expect(state.status).toBe("waiting");
      expect(state.version).toBe(0);
    });

    it("não repete o estado atual nem muda a versão da linha", () => {
      const state = createDemoState();
      setDemoStatus(state, "active");
      expect(() => setDemoStatus(state, "active")).toThrow(/já está/);
      setDemoStatus(state, "paused");
      const version = state.version;
      expect(() => setDemoStatus(state, "paused")).toThrow(/já está/);
      expect(state.version).toBe(version);
    });

    it("encerra a partir de qualquer estado aberto e depois não reabre", () => {
      for (const path of [[], ["active"], ["active", "paused"]] as const) {
        const state = createDemoState();
        for (const step of path) setDemoStatus(state, step);
        setDemoStatus(state, "ended");
        expect(state.status).toBe("ended");
        expect(() => setDemoStatus(state, "active")).toThrow(/encerrada/);
      }
    });
  });

  it("guarda a coordenada solta e ordena as caixas da linha pelas posições", () => {
    const state = createDemoState();
    assignStudent(state, "celular-a");
    assignStudent(state, "celular-b");
    setDemoStatus(state, "active");
    confirmDemoMove(state, "celular-a", 0.1, 1);
    expect(state.confirmedPositions).toEqual({ evaporacao: 0.1 });
    confirmDemoMove(state, "celular-b", 0.3, 2);
    expect(state.confirmedOrder).toEqual(["evaporacao", "condensacao"]);
    confirmDemoMove(state, "celular-a", 0.9, 3);
    expect(state.confirmedOrder).toEqual(["condensacao", "evaporacao"]);
    expect(state.confirmedPositions).toEqual({
      evaporacao: 0.9,
      condensacao: 0.3,
    });
  });

  describe("tema de História", () => {
    const history = () => themes.historia;

    it("tem dez acontecimentos em ordem cronológica e sem datas nos cartões", () => {
      const cards = history().cards;
      expect(cards).toHaveLength(10);
      expect(new Set(cards.map((card) => card.id)).size).toBe(10);
      const years = cards.map((card) => card.year ?? 0);
      expect(
        years.every((year, index) => index === 0 || year > years[index - 1]),
      ).toBe(true);
      // a data não pode aparecer no texto que o aluno lê
      expect(cards.some((card) => /\d{3,4}/.test(card.label))).toBe(false);
    });

    it("nomeia as pontas do eixo como mais antigo e mais recente", () => {
      const state = createDemoState("historia");
      expect(state.axis).toEqual({ start: "Mais antigo", end: "Mais recente" });
      expect(state.instruction).toMatch(/antigo/);
      expect(state.title).toMatch(/Brasil/);
    });

    it("dá a cada aluno um acontecimento diferente do professor e dos colegas até esgotar os dez", () => {
      const state = createDemoState("historia");
      const ids = Array.from({ length: 9 }, (_, index) =>
        assignStudent(state, `aluno-${index}`),
      );
      const templates = ids.map(
        (id) => state.items.find((item) => item.id === id)?.templateId,
      );
      const teacherTemplate = state.items.find(
        (item) => item.id === state.teacherItemId,
      )?.templateId;
      expect(new Set(templates).size).toBe(9);
      expect(templates).not.toContain(teacherTemplate);
      // o décimo aluno é o primeiro a repetir um acontecimento
      const tenth = assignStudent(state, "aluno-9");
      expect(state.items.find((item) => item.id === tenth)?.templateId).toBe(
        teacherTemplate,
      );
    });

    it("embaralha a distribuição para a ordem de entrada não revelar a resposta", () => {
      const chronological = history().cards.map((card) => card.id);
      const state = createDemoState("historia", () => 0);
      expect([...state.deck].sort()).toEqual([...chronological].sort());
      expect(state.deck).not.toEqual(chronological);
      const other = createDemoState("historia");
      expect([...other.deck].sort()).toEqual([...chronological].sort());
    });

    it("mostra na referência os acontecimentos do mais antigo ao mais recente, com o ano", () => {
      const state = createDemoState("historia");
      for (let index = 0; index < 10; index++)
        assignStudent(state, `aluno-${index}`);
      const reference = referenceLabels(state);
      expect(reference).toHaveLength(10);
      expect(reference[0]).toBe("Chegada de Cabral ao Brasil (1500)");
      expect(reference[9]).toBe("Promulgação da Constituição Cidadã (1988)");
    });

    it("rejeita um tema desconhecido", () => {
      expect(() => createDemoState("inexistente")).toThrow(/tema/i);
    });
  });

  describe("escolha do tema pelo professor", () => {
    it("oferece vários temas, sem trocar o tema inicial do Ciclo da água", () => {
      const list = listThemes();
      expect(list.map((theme) => theme.id)).toEqual([
        "ciclo-da-agua",
        "historia",
        "sistema-solar",
        "metamorfose",
      ]);
      expect(list[0]).toEqual({
        id: "ciclo-da-agua",
        title: "Ciclo da água",
        cardCount: 3,
      });
      expect(createDemoState().themeId).toBe("ciclo-da-agua");
    });

    it("mantém cada tema válido, com cartões de ids únicos e ao menos três etapas", () => {
      for (const theme of Object.values(themes)) {
        const ids = theme.cards.map((card) => card.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length >= 3).toBe(true);
        expect(theme.axis.start).toBeTruthy();
        expect(theme.axis.end).toBeTruthy();
      }
    });

    it("troca o tema antes de iniciar, mantendo código e alunos já conectados", () => {
      const state = createDemoState("ciclo-da-agua");
      state.code = "TURMA123";
      assignStudent(state, "aluno-a");
      assignStudent(state, "aluno-b");
      const next = changeTheme(state, "sistema-solar");
      expect(next.code).toBe("TURMA123");
      expect(next.themeId).toBe("sistema-solar");
      expect(next.title).toMatch(/planetas|Sistema Solar/i);
      expect(next.axis.start).toMatch(/perto/);
      expect(Object.keys(next.members).sort()).toEqual(["aluno-a", "aluno-b"]);
      for (const itemId of Object.values(next.members)) {
        const item = next.items.find((candidate) => candidate.id === itemId);
        expect(themes["sistema-solar"].cards.map((c) => c.label)).toContain(
          item?.label,
        );
      }
      expect(next.status).toBe("waiting");
      expect(next.confirmedOrder).toEqual([]);
    });

    it("não troca o tema depois que a atividade começou", () => {
      const state = createDemoState();
      setDemoStatus(state, "active");
      expect(() => changeTheme(state, "historia")).toThrow(/antes de iniciar/);
      setDemoStatus(state, "paused");
      expect(() => changeTheme(state, "historia")).toThrow(/antes de iniciar/);
    });

    it("rejeita um tema que não existe", () => {
      expect(() => changeTheme(createDemoState(), "inexistente")).toThrow(
        /tema/i,
      );
    });

    it("entrega os planetas e as fases da borboleta em ordem embaralhada e correta na referência", () => {
      const solar = createDemoState("sistema-solar");
      for (let index = 0; index < 8; index++)
        assignStudent(solar, `aluno-${index}`);
      expect(referenceLabels(solar)).toEqual([
        "Mercúrio",
        "Vênus",
        "Terra",
        "Marte",
        "Júpiter",
        "Saturno",
        "Urano",
        "Netuno",
      ]);
      const borboleta = createDemoState("metamorfose");
      for (let index = 0; index < 4; index++)
        assignStudent(borboleta, `aluno-${index}`);
      expect(referenceLabels(borboleta)).toEqual([
        "Ovo",
        "Lagarta",
        "Crisálida",
        "Borboleta",
      ]);
    });
  });
});
