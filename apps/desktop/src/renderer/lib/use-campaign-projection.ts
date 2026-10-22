import type { PlayerProjection } from "@bluewave/campaign-engine";
import { useBridgeQuery } from "./use-bridge-query.js";

export interface CampaignProjectionState {
  readonly projection: PlayerProjection | null;
  readonly loadError: string | null;
}

export function useCampaignProjection(sessionId: string): CampaignProjectionState {
  const state = useBridgeQuery(sessionId, null, (bridge, id) =>
    bridge.campaign.execute("inspectCampaign", id),
  );

  if (state.status === "ready") return { projection: state.value.projection, loadError: null };
  if (state.status === "error") return { projection: null, loadError: state.message };
  return { projection: null, loadError: null };
}
