import type { InspectPrioritiesResult, StrategicPriority } from "@bluewave/campaign-engine";

import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { useBridgeQuery } from "../../lib/use-bridge-query.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export type PrioritiesState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly priorities: readonly StrategicPriority[] }
  | { readonly status: "unavailable" };

/**
 * The engine's strategic priorities for the player, severity-sorted by the engine.
 * Reloads when the campaign revision changes (the month advanced elsewhere).
 */
export function usePriorities(sessionId: string): PrioritiesState {
  const revision = useCampaignRevision();
  const state = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id): Promise<BridgeResult<InspectPrioritiesResult>> =>
      bridge.campaign.execute("inspectPriorities", id),
  );

  if (state.status === "ready") return { status: "ready", priorities: state.value.priorities };
  if (state.status === "error") return { status: "unavailable" };
  return { status: "loading" };
}
