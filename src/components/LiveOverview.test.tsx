import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveOverview } from "./LiveOverview";

describe("visão dos movimentos para turma grande", () => {
  it("mostra cada caixa em posição 2D visível mesmo quando o eixo detalhado rola", () => {
    render(
      <LiveOverview
        items={[
          { id: "a", label: "Evaporação" },
          { id: "b", label: "Condensação" },
        ]}
        previews={{
          a: { dragId: "d1", seq: 1, x: 0.8, y: 0.2, version: 1, sentAt: 100 },
          b: { dragId: "d2", seq: 1, x: 0.3, y: 0.7, version: 1, sentAt: 100 },
        }}
      />,
    );
    expect(screen.getByTestId("live-a")).toHaveStyle({
      left: "75.2%",
      top: "39.4%",
    });
    expect(screen.getByTestId("live-b")).toHaveStyle({
      left: "33.2%",
      top: "67.9%",
    });
  });
});
