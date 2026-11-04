import { useCallback, useMemo, useState } from "react";
import type { PrimaryAction } from "../../../../shell/primary-action.js";
import { FLEET_METHOD_CARDS, type FleetMethodCardContent } from "../../fleet-method-content.js";
import type { FleetMethodDraft } from "../../new-game-fleet-method-screen-state.js";

export interface FleetMethodWorkspaceInput {
  readonly initialFleetMethod: FleetMethodDraft;
  readonly launching: boolean;
  readonly onNext: (fleetMethod: FleetMethodDraft) => void;
}

export interface FleetMethodWorkspaceState {
  readonly focusedIndex: number;
  readonly pendingId: string | null;
  readonly fleetMethod: FleetMethodDraft;
}

export interface FleetMethodWorkspaceActions {
  readonly focusIndex: (index: number) => void;
  readonly activateIndex: (index: number) => void;
  readonly commit: () => void;
}

export interface FleetMethodDeckMeta {
  readonly focusedIndex: number;
  readonly activeId: string;
}

export interface FleetMethodDetailMeta {
  readonly card: FleetMethodCardContent | null;
  readonly applied: boolean;
  readonly pending: boolean;
}

export interface FleetMethodWorkspaceMeta {
  readonly deck: FleetMethodDeckMeta;
  readonly detail: FleetMethodDetailMeta;
  readonly activeName: string;
  readonly primaryAction: PrimaryAction;
}

export interface FleetMethodWorkspace {
  readonly state: FleetMethodWorkspaceState;
  readonly actions: FleetMethodWorkspaceActions;
  readonly meta: FleetMethodWorkspaceMeta;
}

function cardIdAt(index: number): string | null {
  return FLEET_METHOD_CARDS[index]?.id ?? null;
}

export function useFleetMethodWorkspace({
  initialFleetMethod,
  launching,
  onNext,
}: FleetMethodWorkspaceInput): FleetMethodWorkspace {
  const [fleetMethod, setFleetMethod] = useState<FleetMethodDraft>(initialFleetMethod);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [focusOverride, setFocusOverride] = useState<number | null>(null);

  const activeIndex = FLEET_METHOD_CARDS.findIndex(
    (card) => card.id === fleetMethod.legacyFleetModeId,
  );
  const focusedIndex = focusOverride ?? Math.max(0, activeIndex);
  const focusedCard = FLEET_METHOD_CARDS[focusedIndex] ?? FLEET_METHOD_CARDS[0];
  const activeCardName =
    FLEET_METHOD_CARDS.find((card) => card.id === fleetMethod.legacyFleetModeId)?.title ?? "";
  const focusedCardId = focusedCard?.id ?? null;

  const needsSelect = pendingId !== null && pendingId !== fleetMethod.legacyFleetModeId;

  const applyId = useCallback((cardId: string) => {
    setFleetMethod({ legacyFleetModeId: cardId });
    setPendingId(null);
  }, []);

  const focusIndex = useCallback((index: number) => {
    setFocusOverride(index);
    setPendingId(cardIdAt(index));
  }, []);

  const activateIndex = useCallback(
    (index: number) => {
      const cardId = cardIdAt(index);
      if (cardId === null) return;
      setFocusOverride(index);
      applyId(cardId);
    },
    [applyId],
  );

  const commit = useCallback(() => {
    if (launching) return;
    if (needsSelect && pendingId !== null) {
      applyId(pendingId);
      return;
    }
    onNext(fleetMethod);
  }, [launching, needsSelect, pendingId, applyId, fleetMethod, onNext]);

  const state = useMemo<FleetMethodWorkspaceState>(
    () => ({ focusedIndex, pendingId, fleetMethod }),
    [focusedIndex, pendingId, fleetMethod],
  );

  const actions = useMemo<FleetMethodWorkspaceActions>(
    () => ({ focusIndex, activateIndex, commit }),
    [focusIndex, activateIndex, commit],
  );

  const deck = useMemo<FleetMethodDeckMeta>(
    () => ({ focusedIndex, activeId: fleetMethod.legacyFleetModeId }),
    [focusedIndex, fleetMethod.legacyFleetModeId],
  );

  const detail = useMemo<FleetMethodDetailMeta>(
    () => ({
      card: focusedCard ?? null,
      applied: focusedCardId !== null && focusedCardId === fleetMethod.legacyFleetModeId,
      pending:
        focusedCardId !== null &&
        pendingId === focusedCardId &&
        focusedCardId !== fleetMethod.legacyFleetModeId,
    }),
    [focusedCard, focusedCardId, pendingId, fleetMethod.legacyFleetModeId],
  );

  const meta = useMemo<FleetMethodWorkspaceMeta>(
    () => ({
      deck,
      detail,
      activeName: activeCardName,
      primaryAction: {
        label: needsSelect ? "Select" : launching ? "Starting…" : "Next: Review Campaign",
        disabled: launching,
        onTrigger: commit,
      },
    }),
    [deck, detail, activeCardName, needsSelect, launching, commit],
  );

  return { state, actions, meta };
}
