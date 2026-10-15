import type { BridgeResult } from "../../../shared/bridge-contract.js";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { useBridgeQuery } from "../../lib/use-bridge-query.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export type NationRailLoad =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly projection: DiplomacyScreenProjection }
  | { readonly status: "unavailable" };

/** The Diplomacy & War inspect view, reloaded when the campaign revision changes. */
export function useNationRail(sessionId: string): NationRailLoad {
  const revision = useCampaignRevision();
  const state = useBridgeQuery(
    sessionId,
    revision,
    (bridge, id): Promise<BridgeResult<DiplomacyScreenProjection>> =>
      bridge.campaign.execute("inspectDiplomacyScreen", id),
  );

  if (state.status === "ready") return { status: "ready", projection: state.value };
  if (state.status === "error") return { status: "unavailable" };
  return { status: "loading" };
}
