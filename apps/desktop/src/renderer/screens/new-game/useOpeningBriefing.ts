import { useMemo, useSyncExternalStore } from "react";

import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import type { InspectOpeningBriefingResult } from "../../../shared/campaign-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { createValueStore, subscribeWithLifecycle } from "../../lib/value-store.js";

export type LoadOpeningBriefing = (
  sessionId: string,
) => Promise<BridgeResult<InspectOpeningBriefingResult>>;

export interface OpeningBriefing {
  readonly projection: OpeningBriefingProjection | null;
  readonly error: string | null;
}

const INITIAL_BRIEFING: OpeningBriefing = { projection: null, error: null };

export function useOpeningBriefing(sessionId: string, load: LoadOpeningBriefing): OpeningBriefing {
  const { store, subscribe } = useMemo(() => {
    const created = createValueStore<OpeningBriefing>(INITIAL_BRIEFING);
    return {
      store: created,
      subscribe: subscribeWithLifecycle(created, (target) => {
        let active = true;
        void load(sessionId).then((result) => {
          if (!active) return;
          if (result.outcome !== "success") {
            target.set({ projection: null, error: result.reason });
            return;
          }
          target.set({ projection: result.value.projection, error: null });
        });
        return () => {
          active = false;
        };
      }),
    };
  }, [sessionId, load]);

  return useSyncExternalStore(subscribe, store.get);
}
