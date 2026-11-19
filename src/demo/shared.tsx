import type { RefObject } from "react";
import { DragCard } from "../components/DragCard";
import { trackPosition } from "../components/TrackBoard";
import type { Preview } from "../domain/preview";
import { dropPosition, slotOf } from "../domain/track";
import type { DemoSnapshot } from "./client";

export function boardData(state: DemoSnapshot | null) {
  const cards = state?.cards ?? [];
  return {
    // as caixas da linha são os cartões; as ocorrências dos alunos só dão nome às prévias
    items: [...cards, ...(state?.items ?? [])],
    order: state?.confirmedOrder ?? [],
    positions: state?.confirmedPositions,
    slots: trackSlots(state),
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

type Card = { id: string; label: string };

/** Casas da trilha: uma por cartão diferente em jogo (nunca menos que os já na linha). */
export function trackSlots(state: DemoSnapshot | null): number {
  const labels = new Set((state?.items ?? []).map((item) => item.label));
  return Math.max(1, labels.size, state?.confirmedOrder.length ?? 0);
}

/**
 * Posição enviada ao soltar um cartão perto de `position`: encaixa na casa e,
 * se ela já tiver outro cartão, entra logo antes dele, que é empurrado.
 */
export function snapToTrack(
  state: DemoSnapshot | null,
  itemId: string,
  position: number,
): number {
  const slots = trackSlots(state);
  const ownLabel = state?.items.find((item) => item.id === itemId)?.label;
  const positions = state?.confirmedPositions ?? {};
  // os outros cartões da trilha; o próprio cartão sai do lugar antigo ao ser solto
  const others = (state?.cards ?? [])
    .filter((card) => card.label !== ownLabel)
    .map((card) => positions[card.id] ?? 0.5)
    .sort((a, b) => a - b);
  return dropPosition(slotOf(position, slots), others, slots);
}

/** Cartões de quem recebeu o estado, na ordem em que foram entregues. */
export function ownCards(state: DemoSnapshot | null): Card[] {
  return (state?.ownItemIds ?? []).flatMap((id) => {
    const item = state?.items.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });
}

/** Mais de uma pessoa recebeu o mesmo cartão, então a posição é votada. */
export function isSharedCard(
  state: DemoSnapshot | null,
  itemId: string | undefined,
): boolean {
  const own = state?.items.find((item) => item.id === itemId);
  return (
    !!own &&
    (state?.items.filter((item) => item.label === own.label).length ?? 0) > 1
  );
}

export function placedMessage(shared: boolean, isTeacher = false): string {
  if (shared)
    return "Seu voto foi registrado. A caixa fica no consenso de quem tem o mesmo cartão.";
  return isTeacher
    ? "Seu cartão foi colocado na linha."
    : "Sua caixa foi colocada na linha coletiva.";
}

/** Cartões próprios, cada um arrastável, com a marca dos que já estão na linha. */
export function OwnCards({
  cards,
  placedIds,
  boardRef,
  version,
  disabled,
  onLocalPreview,
  onPreview,
  onDrop,
}: {
  cards: Card[];
  placedIds: string[];
  boardRef: RefObject<HTMLDivElement | null>;
  version: number;
  disabled: boolean;
  onLocalPreview: (itemId: string, preview: Preview | null) => void;
  onPreview: (
    itemId: string,
    preview: Preview,
    event: "move" | "cancel",
  ) => void;
  onDrop: (itemId: string, x: number, version: number) => Promise<void>;
}) {
  return (
    <ul className="own-cards">
      {cards.map((card) => (
        <li key={card.id}>
          <DragCard
            label={card.label}
            boardRef={boardRef}
            version={version}
            disabled={disabled}
            onLocalPreview={(preview) => onLocalPreview(card.id, preview)}
            onPreview={(preview, event) => onPreview(card.id, preview, event)}
            onDrop={(x, dropVersion) => onDrop(card.id, x, dropVersion)}
            locate={(clientX, clientY) => ({
              x: boardRef.current
                ? trackPosition(boardRef.current, clientX, clientY)
                : 0.5,
              y: 0.5,
            })}
          />
          {placedIds.includes(card.id) && (
            <span className="placed-mark">✓ na linha</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Troca ou remove a prévia local de um cartão. */
export function replacePreview(
  current: Record<string, Preview>,
  itemId: string,
  preview: Preview | null,
): Record<string, Preview> {
  const next = { ...current };
  if (preview) next[itemId] = preview;
  else delete next[itemId];
  return next;
}

/** Prévias da linha com as do próprio arraste, que seguem o dedo sem esperar o servidor. */
export function withLocalPreviews(
  state: DemoSnapshot | null,
  local: Record<string, Preview>,
) {
  return { ...(state?.previews ?? {}), ...local };
}

export function Header({ role }: { role: string }) {
  return (
    <header className="app-header">
      <a className="logo" href="/">
        <img className="brand-mark" src="/linha-viva-marca.svg" alt="" />
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
