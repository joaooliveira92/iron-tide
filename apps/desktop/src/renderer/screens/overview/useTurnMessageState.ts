import { useCallback, useEffect, useState } from "react";
import type { UiStateTurnMessages } from "../../../shared/campaign-command-contract.js";
import { useBridge } from "../../lib/bridge-context.js";
import { writeUiStatePatch } from "../../lib/uiStateSidecar.js";

const EMPTY: UiStateTurnMessages = { pinnedIds: [], readIds: [] };

function toggled(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export interface TurnMessageState {
  readonly turnMessages: UiStateTurnMessages;
  readonly togglePinned: (id: string) => void;
  readonly toggleRead: (id: string) => void;
}

/**
 * The reader's pin/read state for turn-summary messages, persisted per campaign
 * in `ui-state.json` (non-authoritative). It never deletes a message — it only
 * records presentation state — and is carried forward by the shared
 * read-before-write merge so it never erases the other UI-state features.
 */
export function useTurnMessageState(sessionId: string): TurnMessageState {
  const bridge = useBridge();
  const [turnMessages, setTurnMessages] = useState<UiStateTurnMessages>(EMPTY);

  useEffect(() => {
    if (bridge === undefined) return;
    let active = true;
    void bridge.campaign
      .execute("readUiState", sessionId)
      .then((result) => {
        if (!active || result.outcome !== "success") return;
        const stored = result.value.uiState.turnMessages;
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
