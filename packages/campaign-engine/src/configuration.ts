import type {
  CampaignConfiguration as EngineCampaignConfiguration,
  CampaignSnapshot,
} from "@bluewave/campaign";
import { compareCodePoints } from "@bluewave/deterministic";

export type CampaignConfiguration = EngineCampaignConfiguration & {
  readonly archetype?: string;
};

export interface SupportedConfigurationValues {
  readonly scenarioId: readonly string[];
  readonly continuityMode: readonly string[];
  readonly fleetSize: readonly string[];
  readonly researchSpeed: readonly string[];
  readonly technologyVariation: readonly string[];
  readonly historicalBudget: readonly string[];
  readonly legacyFleetMode: readonly string[];
  readonly tacticalRealism: readonly string[];
  readonly difficulty: readonly string[];
  readonly playerSlotId: readonly string[];
}

export function hasOwnContent(snapshot: CampaignSnapshot, nationId: string): boolean {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return false;
  if (nation.constructionProjects.length > 0) return true;
  for (const design of snapshot.designs.values()) {
    if (design.nationId === nationId) return true;
  }
  return false;
}

export function supportedPlayerSlotIds(snapshot: CampaignSnapshot): readonly string[] {
  const ids: string[] = [];
  for (const [nationId, nation] of snapshot.nations) {
    if (!nation.isPlayable) continue;
    if (!hasOwnContent(snapshot, nationId)) continue;
    ids.push(nationId);
  }
  return ids.sort((a, b) => compareCodePoints(a, b));
}
