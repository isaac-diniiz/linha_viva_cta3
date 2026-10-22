import type { DemoSnapshot } from "./client";

export function boardData(state: DemoSnapshot | null) {
  const cards = state?.cards ?? [];
  return {
    // as caixas da linha são os cartões; as ocorrências dos alunos só dão nome às prévias
    items: [...cards, ...(state?.items ?? [])],
    order: state?.confirmedOrder ?? [],
    positions: state?.confirmedPositions,
    cardCount: cards.length,
    startLabel: state?.axis.start,
    endLabel: state?.axis.end,
    votes: Object.fromEntries(
      cards.map((card) => [
        card.id,
        { votes: card.votes, total: card.total, marks: card.marks },
      ]),
    ),
  };
}

/** Mais de uma pessoa recebeu o mesmo cartão, então a posição é votada. */
export function isSharedCard(state: DemoSnapshot | null): boolean {
  const own = state?.items.find((item) => item.id === state.ownItemId);
  return (
    !!own &&
    (state?.items.filter((item) => item.label === own.label).length ?? 0) > 1
  );
}

export function Header({ role }: { role: string }) {
  return (
    <header className="app-header">
      <a className="logo" href="/">
        <span className="logo-mark">L</span>
        <span>Linha Viva</span>
      </a>
      <span className="header-tag">DEMONSTRAÇÃO · {role}</span>
    </header>
  );
}

export function Connection({
  connected,
  error,
}: {
  connected: boolean;
  error: string;
}) {
  return (
    <>
      {!connected && (
        <div className="notice error" role="status">
          Reconectando ao computador. Aguarde para continuar.
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
