import { createContext, use, useCallback, useRef } from "react";
import type { BridgeResult } from "../../../../shared/bridge-contract.js";
import type { FleetScreenProjection } from "../../../../shared/fleet-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { loadThroughBridge } from "../../../lib/bridge-read.js";
import { useCampaignRevision } from "../../../shell/CampaignShellContext.js";

export interface FleetInspectionLoadOptions {
  readonly fresh?: boolean;
}

export type LoadFleetInspection = (
  options?: FleetInspectionLoadOptions,
) => Promise<BridgeResult<FleetScreenProjection>>;

interface CachedInspection {
  readonly revision: number | null;
  readonly pending: Promise<BridgeResult<FleetScreenProjection>>;
}

export const FleetInspectionContext = createContext<LoadFleetInspection | null>(null);

export function useFleetInspectionCache(sessionId: string): LoadFleetInspection {
  const bridge = useBridge();
  const campaignRevision = useCampaignRevision();
  const cache = useRef<CachedInspection | null>(null);
  return useCallback(
    (options?: FleetInspectionLoadOptions) => {
      const cached = cache.current;
      if (options?.fresh !== true && cached !== null && cached.revision === campaignRevision) {
        return cached.pending;
      }
      const entry: CachedInspection = {
        revision: campaignRevision,
        pending: loadThroughBridge(bridge, (b) =>
          b.campaign.execute("inspectFleetScreen", sessionId),
        ),
      };
      cache.current = entry;
      const forget = () => {
        if (cache.current === entry) cache.current = null;
      };
      entry.pending.then((result) => {
        if (result.outcome !== "success") forget();
      }, forget);
      return entry.pending;
    },
    [bridge, campaignRevision, sessionId],
  );
}

export function useFleetInspectionLoader(sessionId: string): LoadFleetInspection {
  const own = useFleetInspectionCache(sessionId);
  const shared = use(FleetInspectionContext);
  return shared ?? own;
}
