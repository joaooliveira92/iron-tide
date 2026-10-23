import type { CampaignState } from "@bluewave/campaign";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import type { ResearchUnfundedReason } from "@bluewave/campaign";
import { derivePlayerFacts } from "./player-facts.js";
import type { PlayerProjectionMonth } from "./projection.js";

export { CANONICAL_RESEARCH_FIELD_IDS, MAX_HIGH_PRIORITY_FIELDS, RESEARCH_FIELD_PRIORITY_WEIGHTS };
export type { ResearchFieldId } from "@bluewave/content-schema";

export interface ResearchInProgressTechnology {
  readonly techId: string;
  readonly investedPoints: number;
  readonly completed: boolean;
}

export interface ResearchScreenProjection {
  readonly nationId: string;
  readonly researchBudget: number;
  readonly annualAllocation: number | null;
  readonly researchCap: number;
  readonly unfundedReason: ResearchUnfundedReason | null;
  readonly fieldPriorities: Readonly<Record<string, number>>;
  readonly discoveredTechIds: readonly string[];
  readonly inProgressTechnologies: readonly ResearchInProgressTechnology[];
  readonly currentProjectTechId: string | null;
}

export function buildResearchScreenProjection(
  state: CampaignState,
  playerSlotId: string,
  _month: PlayerProjectionMonth,
): ResearchScreenProjection | undefined {
  const facts = derivePlayerFacts(state.snapshot, playerSlotId);
  if (facts === undefined) return undefined;

  const { outlook } = facts;
  const research = facts.nation.research;
  const fieldPriorities: Record<string, number> = {};
  for (const [fieldId, weight] of Object.entries(research.fieldPriorities)) {
    fieldPriorities[fieldId] = Number(weight);
  }

  return {
    nationId: research.nationId,
    researchBudget: Number(research.researchBudget),
    annualAllocation:
      research.annualResearchAllocation === undefined
        ? null
        : Number(research.annualResearchAllocation),
    researchCap: outlook.researchCap,
    unfundedReason: outlook.researchUnfundedReason ?? null,
    fieldPriorities,
    discoveredTechIds: [...research.discoveredTechs].sort((a, b) => a.localeCompare(b)),
    inProgressTechnologies: research.technologies.map((tech) => ({
      techId: tech.techId,
      investedPoints: Number(tech.investedPoints),
      completed: tech.completed,
    })),
    currentProjectTechId: research.currentProjectTechId ?? null,
  };
}
