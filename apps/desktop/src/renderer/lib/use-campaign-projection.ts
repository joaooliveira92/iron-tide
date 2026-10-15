import type { PlayerProjection } from "@bluewave/campaign-engine";
import { useBridgeQuery } from "./use-bridge-query.js";

/** A screen's base read: the campaign projection once loaded, or why the read failed. */
export interface CampaignProjectionState {
  readonly projection: PlayerProjection | null;
  readonly loadError: string | null;
}

/**
 * Reads the campaign projection via `inspectCampaign`, through the shared
 * read-only `useBridgeQuery` convention (ADR-0075), folded to
 * `projection | loadError`. Every screen that renders the base projection at
 * mount reads it here rather than hand-rolling its own bridge call and reducers.
 */
export function useCampaignProjection(sessionId: string): CampaignProjectionState {
  const state = useBridgeQuery(sessionId, null, (bridge, id) =>
    bridge.campaign.execute("inspectCampaign", id),
  );

  if (state.status === "ready") return { projection: state.value.projection, loadError: null };
  if (state.status === "error") return { projection: null, loadError: state.message };
  return { projection: null, loadError: null };
}
