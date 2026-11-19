import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { slotCenter } from "../domain/track";
import { trackPosition, TrackBoard } from "./TrackBoard";

const cards = [
  { id: "evaporacao", label: "Evaporação" },
  { id: "condensacao", label: "Condensação" },
  { id: "precipitacao", label: "Precipitação" },
];

function board(props: Partial<Parameters<typeof TrackBoard>[0]> = {}) {
  return render(
    <TrackBoard
      items={cards}
      order={[]}
      positions={{}}
      slots={4}
      startLabel="Início"
      endLabel="Fim"
      previews={{}}
      {...props}
    />,
  );
}

describe("trilha da turma", () => {
  it("mostra uma casa numerada por cartão em jogo, com as pontas identificadas", () => {
    board();
    const slots = screen.getAllByTestId(/^track-slot-/);
    expect(slots.map((slot) => slot.getAttribute("data-number"))).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(within(slots[0]).getByText("Início")).toBeInTheDocument();
    expect(within(slots[3]).getByText("Fim")).toBeInTheDocument();
  });

  it("põe cada cartão confirmado numa casa, na ordem da linha, mesmo soltos perto", () => {
    board({
      order: ["evaporacao", "condensacao", "precipitacao"],
      positions: { evaporacao: 0.1, condensacao: 0.12, precipitacao: 0.9 },
    });
    const slotOf = (id: string) =>
      screen.getByTestId(`confirmed-${id}`).getAttribute("data-slot");
    expect(slotOf("evaporacao")).toBe("0");
    expect(slotOf("condensacao")).toBe("1");
    expect(slotOf("precipitacao")).toBe("3");
    expect(screen.getByTestId("confirmed-condensacao")).toHaveTextContent(
      "Condensação",
    );
  });

  it("informa quantos votaram nos cartões repetidos", () => {
    board({
      order: ["evaporacao"],
      positions: { evaporacao: slotCenter(1, 4) },
      votes: { evaporacao: { votes: 2, total: 3, marks: [0.3, 0.35] } },
    });
    expect(screen.getByText("2 de 3 votaram")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^vote-mark-evaporacao-/)).toHaveLength(2);
  });

  it("mostra a prévia de um arraste andando pela trilha, com a posição recebida", () => {
    board({
      previews: {
        evaporacao: {
          dragId: "d1",
          seq: 1,
          x: 0.4,
          y: 0.5,
          version: 1,
          sentAt: 1,
        },
      },
      smoothPreviews: false,
    });
    const preview = screen.getByTestId("preview-evaporacao");
    expect(preview).toHaveTextContent("Evaporação");
    expect(preview.getAttribute("data-position")).toBe("0.4");
  });

  it("converte o ponto do dedo na posição da trilha mais próxima", () => {
    const { container } = board();
    const track = container.querySelector<HTMLElement>(".track")!;
    // 4 casas, 4 por fileira (sem medida, até 6), fileiras de 132 px abaixo do topo
    track.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect;
    const rowTop = Number(track.dataset.top);
    const rowHeight = Number(track.dataset.rowHeight);
    // centro da 3ª casa: coluna 2 de 4 colunas de 200 px
    expect(trackPosition(track, 500, rowTop + rowHeight / 2)).toBeCloseTo(
      slotCenter(2, 4),
    );
  });
});
