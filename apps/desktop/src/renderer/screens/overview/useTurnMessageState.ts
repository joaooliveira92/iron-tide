import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { UiStateTurnMessages } from "../../../shared/ui-state-contract.js";
import { useBridge } from "../../lib/bridge-context.js";
import { createValueStore, subscribeWithLifecycle } from "../../lib/value-store.js";
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
  const [store] = useState(() => createValueStore<UiStateTurnMessages>(EMPTY));

  const subscribe = useMemo(
    () =>
      subscribeWithLifecycle(store, (target) => {
        if (bridge === undefined) return;
        let active = true;
        void readUiState(bridge, sessionId)
          .then((uiState) => {
            if (!active) return;
            const stored = uiState?.turnMessages;
            if (stored !== undefined) target.set(stored);
          })
          .catch(() => undefined);
        return () => {
          active = false;
        };
      }),
    [store, bridge, sessionId],
  );
  const turnMessages = useSyncExternalStore(subscribe, store.get);

  const togglePinned = useCallback(
    (id: string) =>
      store.set((current) => {
        const next = { ...current, pinnedIds: toggled(current.pinnedIds, id) };
        void writeUiStatePatch(bridge, sessionId, { turnMessages: next });
        return next;
      }),
    [store, bridge, sessionId],
  );

  const toggleRead = useCallback(
    (id: string) =>
      store.set((current) => {
        const next = { ...current, readIds: toggled(current.readIds, id) };
        void writeUiStatePatch(bridge, sessionId, { turnMessages: next });
        return next;
      }),
    [store, bridge, sessionId],
  );

  return { turnMessages, togglePinned, toggleRead };
}
