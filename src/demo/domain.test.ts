import { resolve } from "node:path";
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
  ownedItems,
  referenceLabels,
  setCardsPerParticipant,
  setDemoStatus,
  type DemoState,
} from "./domain";
import { findTheme, loadActivities } from "./catalog";

const { themes: catalog } = loadActivities(resolve("atividades"));
const theme = (id: string) => findTheme(catalog, id);
const water = theme("ciclo-da-agua");

describe("demonstração na rede local", () => {
  it("mantém a prévia de outro arraste após uma confirmação concorrente e bloqueia gesto de antes da pausa", () => {
    const state = createDemoState(water);
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
    const state = createDemoState(water);
    const tokens = ["joao1", "joao2", "joao3", "maria", "ana", "bia", "caio"];
    const assigned = tokens.map((token) => assignStudent(state, token)[0]);
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
    expect(new Set([...state.teacherItemIds, ...assigned]).size).toBe(8);
    expect(assignStudent(state, "maria")).toEqual([assigned[3]]);
    expect(state.items).toHaveLength(8);
  });

  it("mostra uma única caixa na linha para cartões repetidos, com a posição votada pelos alunos", () => {
    const state = createDemoState(water);
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
    const state = createDemoState(water);
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
    const state = createDemoState(water);
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
    const state = createDemoState(water);
    ["a", "b", "c", "d", "e"].forEach((token) => assignStudent(state, token));
    expect(referenceLabels(state)).toEqual([
      "Evaporação",
      "Condensação",
      "Precipitação",
    ]);
  });

  it("atribui um item por identidade e conserva a atribuição na reconexão", () => {
    const state = createDemoState(water);
    const first = assignStudent(state, "celular-a");
    expect(assignStudent(state, "celular-a")).toEqual(first);
    expect(assignStudent(state, "celular-b")).not.toEqual(first);
  });

  it("só confirma o item de um aluno em sessão ativa e com versão atual", () => {
    const state = createDemoState(water);
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
      const state = createDemoState(water);
      expect(() => setDemoStatus(state, "paused")).toThrow(/não começou/);
      expect(state.status).toBe("waiting");
      expect(state.version).toBe(0);
    });

    it("não repete o estado atual nem muda a versão da linha", () => {
      const state = createDemoState(water);
      setDemoStatus(state, "active");
      expect(() => setDemoStatus(state, "active")).toThrow(/já está/);
      setDemoStatus(state, "paused");
      const version = state.version;
      expect(() => setDemoStatus(state, "paused")).toThrow(/já está/);
      expect(state.version).toBe(version);
    });

    it("encerra a partir de qualquer estado aberto e depois não reabre", () => {
      for (const path of [[], ["active"], ["active", "paused"]] as const) {
        const state = createDemoState(water);
        for (const step of path) setDemoStatus(state, step);
        setDemoStatus(state, "ended");
        expect(state.status).toBe("ended");
        expect(() => setDemoStatus(state, "active")).toThrow(/encerrada/);
      }
    });
  });

  it("guarda a coordenada solta e ordena as caixas da linha pelas posições", () => {
    const state = createDemoState(water);
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

  describe("vários cartões por participante", () => {
    const templateOf = (state: DemoState, id: string) =>
      state.items.find((item) => item.id === id)?.templateId;

    it("começa com um cartão por participante", () => {
      expect(createDemoState(water).cardsPerParticipant).toBe(1);
    });

    it("entrega a quantidade escolhida a professor e alunos, sem repetir antes de esgotar o baralho", () => {
      const state = setCardsPerParticipant(
        createDemoState(theme("historia")),
        3,
      );
      const students = ["a", "b", "c"].map((token) =>
        assignStudent(state, token),
      );
      expect(state.teacherItemIds).toHaveLength(3);
      for (const ids of students) expect(ids).toHaveLength(3);
      // professor, a e b somam 9 cartões; o primeiro de c é o décimo
      const firstTen = [...state.teacherItemIds, ...students.flat()]
        .slice(0, 10)
        .map((id) => templateOf(state, id));
      expect(new Set(firstTen).size).toBe(10);
    });

    it("nunca dá o mesmo cartão duas vezes à mesma pessoa, mesmo pedindo mais do que existe", () => {
      const state = setCardsPerParticipant(createDemoState(water), 4);
      const ids = assignStudent(state, "a");
      expect(ids).toHaveLength(3);
      expect(new Set(ids.map((id) => templateOf(state, id))).size).toBe(3);
      expect(state.teacherItemIds).toHaveLength(3);
    });

    it("aceita de 1 a 4 cartões, só antes de iniciar, mantendo código e participantes", () => {
      const state = createDemoState(water);
      state.code = "TURMA123";
      assignStudent(state, "a");
      const next = setCardsPerParticipant(state, 2);
      expect(next.code).toBe("TURMA123");
      expect(next.cardsPerParticipant).toBe(2);
      expect(next.members.a).toHaveLength(2);
      for (const invalid of [0, 5, 1.5, Number.NaN])
        expect(() => setCardsPerParticipant(state, invalid)).toThrow(/1 a 4/);
      setDemoStatus(next, "active");
      expect(() => setCardsPerParticipant(next, 3)).toThrow(/antes de iniciar/);
    });

    it("mantém a quantidade ao trocar de tema", () => {
      const next = changeTheme(
        setCardsPerParticipant(createDemoState(water), 2),
        theme("metamorfose"),
      );
      expect(next.cardsPerParticipant).toBe(2);
      expect(next.teacherItemIds).toHaveLength(2);
    });

    it("registra um voto para cada cartão do participante", () => {
      const state = setCardsPerParticipant(
        createDemoState(theme("historia")),
        2,
      );
      const [first, second] = assignStudent(state, "a");
      setDemoStatus(state, "active");
      confirmDemoMove(state, "a", 0.2, state.version, { itemId: first });
      confirmDemoMove(state, "a", 0.8, state.version, { itemId: second });
      expect(state.votes[first]).toBe(0.2);
      expect(state.votes[second]).toBe(0.8);
      expect(state.confirmedOrder).toHaveLength(2);
    });

    it("pede o cartão quando o participante tem mais de um e recusa cartão alheio", () => {
      const state = setCardsPerParticipant(createDemoState(water), 2);
      assignStudent(state, "a");
      const [other] = assignStudent(state, "b");
      setDemoStatus(state, "active");
      expect(() => confirmDemoMove(state, "a", 0.5, state.version)).toThrow(
        /qual cartão/,
      );
      for (const itemId of [other, state.teacherItemIds[0]])
        expect(() =>
          confirmDemoMove(state, "a", 0.5, state.version, { itemId }),
        ).toThrow(/não é seu/);
      expect(ownedItems(state, "a")).toEqual(state.members.a);
      expect(ownedItems(state, "", true)).toEqual(state.teacherItemIds);
    });

    it("professor confirma o próprio cartão escolhido", () => {
      const state = setCardsPerParticipant(createDemoState(water), 2);
      setDemoStatus(state, "active");
      const [, second] = state.teacherItemIds;
      confirmDemoMove(state, "", 0.4, state.version, {
        itemId: second,
        asTeacher: true,
      });
      expect(state.votes[second]).toBe(0.4);
    });
  });

  describe("tema de História", () => {
    const history = () => theme("historia");

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
      const state = createDemoState(theme("historia"));
      expect(state.axis).toEqual({ start: "Mais antigo", end: "Mais recente" });
      expect(state.instruction).toMatch(/antigo/);
      expect(state.title).toMatch(/Brasil/);
    });

    it("dá a cada aluno um acontecimento diferente do professor e dos colegas até esgotar os dez", () => {
      const state = createDemoState(theme("historia"));
      const ids = Array.from(
        { length: 9 },
        (_, index) => assignStudent(state, `aluno-${index}`)[0],
      );
      const templates = ids.map(
        (id) => state.items.find((item) => item.id === id)?.templateId,
      );
      const teacherTemplate = state.items.find(
        (item) => item.id === state.teacherItemIds[0],
      )?.templateId;
      expect(new Set(templates).size).toBe(9);
      expect(templates).not.toContain(teacherTemplate);
      // o décimo aluno é o primeiro a repetir um acontecimento
      const [tenth] = assignStudent(state, "aluno-9");
      expect(state.items.find((item) => item.id === tenth)?.templateId).toBe(
        teacherTemplate,
      );
    });

    it("embaralha a distribuição para a ordem de entrada não revelar a resposta", () => {
      const chronological = history().cards.map((card) => card.id);
      const state = createDemoState(theme("historia"), () => 0);
      expect([...state.deck].sort()).toEqual([...chronological].sort());
      expect(state.deck).not.toEqual(chronological);
      const other = createDemoState(theme("historia"));
      expect([...other.deck].sort()).toEqual([...chronological].sort());
    });

    it("mostra na referência os acontecimentos do mais antigo ao mais recente, com o ano", () => {
      const state = createDemoState(theme("historia"));
      for (let index = 0; index < 10; index++)
        assignStudent(state, `aluno-${index}`);
      const reference = referenceLabels(state);
      expect(reference).toHaveLength(10);
      expect(reference[0]).toBe("Chegada de Cabral ao Brasil (1500)");
      expect(reference[9]).toBe("Promulgação da Constituição Cidadã (1988)");
    });
  });

  describe("escolha do tema pelo professor", () => {
    it("resume cada atividade do catálogo com disciplina, série e número de cartões", () => {
      const list = listThemes(catalog);
      expect(list).toHaveLength(catalog.length);
      expect(list).toContainEqual({
        id: "ciclo-da-agua",
        title: "Ciclo da água",
        subject: "Ciências",
        grade: "5º ano",
        cardCount: 3,
      });
      expect(list.map((entry) => entry.id)).toContain("narrativa-viva");
    });

    it("troca o tema antes de iniciar, mantendo código e alunos já conectados", () => {
      const state = createDemoState(theme("ciclo-da-agua"));
      state.code = "TURMA123";
      assignStudent(state, "aluno-a");
      assignStudent(state, "aluno-b");
      const next = changeTheme(state, theme("sistema-solar"));
      expect(next.code).toBe("TURMA123");
      expect(next.themeId).toBe("sistema-solar");
      expect(next.title).toMatch(/planetas|Sistema Solar/i);
      expect(next.axis.start).toMatch(/perto/);
      expect(Object.keys(next.members).sort()).toEqual(["aluno-a", "aluno-b"]);
      for (const itemId of Object.values(next.members).flat()) {
        const item = next.items.find((candidate) => candidate.id === itemId);
        expect(theme("sistema-solar").cards.map((c) => c.label)).toContain(
          item?.label,
        );
      }
      expect(next.status).toBe("waiting");
      expect(next.confirmedOrder).toEqual([]);
    });

    it("não troca o tema depois que a atividade começou", () => {
      const state = createDemoState(water);
      setDemoStatus(state, "active");
      expect(() => changeTheme(state, theme("historia"))).toThrow(
        /antes de iniciar/,
      );
      setDemoStatus(state, "paused");
      expect(() => changeTheme(state, theme("historia"))).toThrow(
        /antes de iniciar/,
      );
    });

    it("entrega os planetas e as fases da borboleta em ordem embaralhada e correta na referência", () => {
      const solar = createDemoState(theme("sistema-solar"));
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
      const borboleta = createDemoState(theme("metamorfose"));
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
