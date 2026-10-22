import { useCallback, useEffect, useState } from "react";
import type { UiStateTurnMessages } from "../../../shared/ui-state-contract.js";
import { useBridge } from "../../lib/bridge-context.js";
import { readUiState, writeUiStatePatch } from "../../lib/uiStateSidecar.js";

const EMPTY: UiStateTurnMessages = { pinnedIds: [], readIds: [] };

function toggled(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export interface TurnMessageState {
  readonly turnMessages: UiStateTurnMessages;
  readonly togglePinned: (id: string) => void;
  readonly toggleRead: (id: string) => void;
}

export function useTurnMessageState(sessionId: string): TurnMessageState {
  const bridge = useBridge();
  const [turnMessages, setTurnMessages] = useState<UiStateTurnMessages>(EMPTY);

  useEffect(() => {
    if (bridge === undefined) return;
    let active = true;
    void readUiState(bridge, sessionId)
      .then((uiState) => {
        if (!active) return;
        const stored = uiState?.turnMessages;
        if (stored !== undefined) setTurnMessages(stored);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [bridge, sessionId]);

  const togglePinned = useCallback(
    (id: string) =>
      setTurnMessages((current) => {
        const next = { ...current, pinnedIds: toggled(current.pinnedIds, id) };
        void writeUiStatePatch(bridge, sessionId, { turnMessages: next });
        return next;
      }),
    [bridge, sessionId],
  );

  const toggleRead = useCallback(
    (id: string) =>
      setTurnMessages((current) => {
        const next = { ...current, readIds: toggled(current.readIds, id) };
        void writeUiStatePatch(bridge, sessionId, { turnMessages: next });
        return next;
      }),
    [bridge, sessionId],
  );

  return { turnMessages, togglePinned, toggleRead };
}
