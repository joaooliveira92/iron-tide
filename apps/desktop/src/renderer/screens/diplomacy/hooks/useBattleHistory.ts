import type { BattleHistoryView } from "@bluewave/campaign-engine";

import type { BridgeResult } from "../../../../shared/bridge-contract.js";
import type { InspectBattleHistoryResult } from "../../../../shared/campaign-command-contract.js";
import { useBridgeQuery } from "../../../lib/use-bridge-query.js";

export type BattleHistoryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly history: BattleHistoryView }
  | { readonly status: "error"; readonly message: string };

/**
 * Loads the read-only battle history for the session. Reloads when `revision`
 * changes (a committed month may have resolved new battles).
 */
export function useBattleHistory(sessionId: string, revision: number): BattleHistoryState {
  const state = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id): Promise<BridgeResult<InspectBattleHistoryResult>> =>
      bridge.campaign.execute("inspectBattleHistory", id),
    {
      bridgeUnavailableMessage: "The desktop bridge is unavailable.",
      transportFailureMessage: "Battle history failed to load.",
    },
  );

  if (state.status === "ready") return { status: "ready", history: state.value.history };
  if (state.status === "error") return { status: "error", message: state.message };
  return { status: "loading" };
}
