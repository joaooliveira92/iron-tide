import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import { researchNote } from "../../lib/economy-wording.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { deriveProjectedResearchAllocations } from "./research-allocation.js";
import { draftHighCount, isDraftDirty } from "./research-field-priorities.js";
import type { ResearchScreenActiveData } from "./research-screen-state.js";

export interface ResearchFieldRow {
  readonly fieldId: string;
  readonly label: string;
  readonly weight: number;
  readonly projectedPoints: number;
  readonly isHigh: boolean;
}

export interface ResearchProgressRow {
  readonly techId: string;
  readonly label: string;
  readonly investedPoints: number;
  readonly completed: boolean;
  readonly isCurrentProject: boolean;
}

export interface ResearchTechBadge {
  readonly techId: string;
  readonly label: string;
}

export interface ResearchViewModel {
  readonly researchBudget: number;
  readonly annualAllocation: number | null;
  readonly researchCap: number;
  readonly budgetNote: string | null;
  readonly currentProjectLabel: string | null;
  readonly discoveredTechs: readonly ResearchTechBadge[];
  readonly inProgressTechnologies: readonly ResearchProgressRow[];
  readonly fields: readonly ResearchFieldRow[];
  readonly highCount: number;
  readonly highCap: number;
  readonly highCountValid: boolean;
  readonly dirty: boolean;
}

export function buildResearchViewModel(state: ResearchScreenActiveData): ResearchViewModel {
  const { projection, draft } = state;
  const projected = deriveProjectedResearchAllocations(projection.researchBudget, draft);
  const highCount = draftHighCount(draft);

  return {
    researchBudget: projection.researchBudget,
    annualAllocation: projection.annualAllocation,
    researchCap: projection.researchCap,
    budgetNote: researchNote({
      researchCap: projection.researchCap,
      researchRequested: projection.researchBudget,
      researchUnfundedReason: projection.unfundedReason ?? undefined,
    }),
    currentProjectLabel:
      projection.currentProjectTechId === null ? null : humanizeId(projection.currentProjectTechId),
    discoveredTechs: projection.discoveredTechIds.map((techId) => ({
      techId,
      label: humanizeId(techId),
    })),
    inProgressTechnologies: projection.inProgressTechnologies.map((tech) => ({
      techId: tech.techId,
      label: humanizeId(tech.techId),
      investedPoints: tech.investedPoints,
      completed: tech.completed,
      isCurrentProject: tech.techId === projection.currentProjectTechId,
    })),
    fields: CANONICAL_RESEARCH_FIELD_IDS.map((fieldId) => {
      const weight = draft[fieldId] ?? RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
      return {
        fieldId,
        label: humanizeId(fieldId),
        weight,
        projectedPoints: projected[fieldId] ?? 0,
        isHigh: weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
      };
    }),
    highCount,
    highCap: MAX_HIGH_PRIORITY_FIELDS,
    highCountValid: highCount >= 1 && highCount <= MAX_HIGH_PRIORITY_FIELDS,
    dirty: isDraftDirty(projection, draft),
  };
}
