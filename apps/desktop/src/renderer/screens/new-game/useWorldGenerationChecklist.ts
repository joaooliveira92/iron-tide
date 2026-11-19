import { useState, useSyncExternalStore } from "react";
import {
  NO_SUBSCRIPTION,
  createValueStore,
  subscribeWithLifecycle,
} from "../../lib/value-store.js";
import {
  CHECKLIST_LINES,
  CHECKLIST_REVEAL_INTERVAL_MS,
  FLAVOR_MESSAGES,
  FLAVOR_ROTATION_INTERVAL_MS,
} from "./world-generation-presentation.js";

export interface WorldGenerationChecklistState {
  readonly revealedCount: number;
  readonly flavorText: string;
}

interface ChecklistProgress {
  readonly revealedCount: number;
  readonly flavorIndex: number;
}

function createChecklistTicker() {
  const store = createValueStore<ChecklistProgress>({ revealedCount: 1, flavorIndex: 0 });
  const subscribe = subscribeWithLifecycle(store, (target) => {
    const reveal = setInterval(() => {
      target.set((current) => ({
        ...current,
        revealedCount: Math.min(current.revealedCount + 1, CHECKLIST_LINES.length),
      }));
    }, CHECKLIST_REVEAL_INTERVAL_MS);
    const rotate = setInterval(() => {
      target.set((current) => ({
        ...current,
        flavorIndex: (current.flavorIndex + 1) % FLAVOR_MESSAGES.length,
      }));
    }, FLAVOR_ROTATION_INTERVAL_MS);
    return () => {
      clearInterval(reveal);
      clearInterval(rotate);
    };
  });
  return { store, subscribe };
}

export function useWorldGenerationChecklist(active: boolean): WorldGenerationChecklistState {
  const [ticker] = useState(createChecklistTicker);
  const { revealedCount, flavorIndex } = useSyncExternalStore(
    active ? ticker.subscribe : NO_SUBSCRIPTION,
    ticker.store.get,
  );

  return {
    revealedCount,
    flavorText: FLAVOR_MESSAGES[flavorIndex] ?? FLAVOR_MESSAGES[0]!,
  };
}
