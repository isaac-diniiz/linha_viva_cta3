import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DragCard } from "./DragCard";

describe("arraste do aluno", () => {
  it("envia a posição mais recente no próximo intervalo mesmo sem novo evento do dedo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    const onPreview = vi.fn();
    const cardRef = createRef<HTMLDivElement>();
    render(
      <DragCard
        label="Evaporação"
        boardRef={cardRef}
        version={1}
        disabled={false}
        onPreview={onPreview}
        onLocalPreview={vi.fn()}
        onDrop={vi.fn(async () => {})}
      />,
    );
    const card = screen.getByRole("button", { name: /Arrastar Evaporação/ });
    card.setPointerCapture = vi.fn();
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 40, clientY: 30 });
    expect(
      onPreview.mock.calls.filter(([, event]) => event === "move"),
    ).toHaveLength(1);
    vi.advanceTimersByTime(167);
    const moves = onPreview.mock.calls.filter(([, event]) => event === "move");
    expect(moves).toHaveLength(2);
    expect(moves[1][0].seq).toBeGreaterThan(moves[0][0].seq);
    vi.useRealTimers();
  });

  it("não envia uma atualização extra quando o aluno solta antes do intervalo de 167 ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
    const onPreview = vi.fn();
    const cardRef = createRef<HTMLDivElement>();
    render(
      <DragCard
        label="Evaporação"
        boardRef={cardRef}
        version={1}
        disabled={false}
        onPreview={onPreview}
        onLocalPreview={vi.fn()}
        onDrop={vi.fn(async () => {})}
      />,
    );
    const card = screen.getByRole("button", { name: /Arrastar Evaporação/ });
    card.setPointerCapture = vi.fn();
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 40, clientY: 30 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 40, clientY: 30 });
    expect(
      onPreview.mock.calls.filter(([, event]) => event === "move"),
    ).toHaveLength(1);
    vi.useRealTimers();
  });

  it("cancela a prévia quando a sessão deixa de aceitar movimentos", () => {
    const onPreview = vi.fn();
    const onLocalPreview = vi.fn();
    const boardRef = createRef<HTMLDivElement>();
    const props = {
      label: "Evaporação",
      boardRef,
      version: 1,
      onPreview,
      onLocalPreview,
      onDrop: vi.fn(async () => {}),
    };
    const { rerender } = render(<DragCard {...props} disabled={false} />);
    const card = screen.getByRole("button", { name: /Arrastar Evaporação/ });
    card.setPointerCapture = vi.fn();
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 20, clientY: 20 });
    expect(onPreview).toHaveBeenCalledWith(expect.anything(), "move");
    rerender(<DragCard {...props} disabled />);
    expect(onPreview).toHaveBeenCalledWith(expect.anything(), "cancel");
    expect(onLocalPreview).toHaveBeenLastCalledWith(null);
  });
});
