import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { useRead } from "../../lib/use-read.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export type NationRailLoad =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly projection: DiplomacyScreenProjection }
  | { readonly status: "unavailable" };

export function useNationRail(sessionId: string): NationRailLoad {
  const read = useRead("inspectDiplomacyScreen", sessionId, useCampaignRevision());

  if (read.status === "ready") return { status: "ready", projection: read.value };
  if (read.status === "unavailable") return { status: "unavailable" };
  return { status: "loading" };
}
