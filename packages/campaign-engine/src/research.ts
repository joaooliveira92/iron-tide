import {
  discoveryDrawWeight,
  eligibleTechnologiesForField,
  historicalTimingModifierBp,
  technologyCatalogueOf,
  type CampaignState,
} from "@bluewave/campaign";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import type { ResearchState, ResearchUnfundedReason } from "@bluewave/campaign";
import { derivePlayerFacts, isLowResearchSpending } from "./player-facts.js";
import { MIN_RESEARCH_SHARE_BP } from "./priorityConstants.js";
import type { PlayerProjectionMonth } from "./projection.js";

export { CANONICAL_RESEARCH_FIELD_IDS, MAX_HIGH_PRIORITY_FIELDS, RESEARCH_FIELD_PRIORITY_WEIGHTS };
export type { ResearchFieldId } from "@bluewave/content-schema";

export interface ResearchInProgressTechnology {
  readonly techId: string;
  readonly investedPoints: number;
  readonly completed: boolean;
}

export type ResearchTechStatus = "discovered" | "researching" | "open" | "locked" | "future";

export interface ResearchTechnologyProjection {
  readonly techId: string;
  readonly name: string | null;
  readonly researchFieldId: string;
  readonly status: ResearchTechStatus;
  readonly cost: number;
  readonly investedPoints: number;
  readonly prerequisiteIds: readonly string[];
  readonly missingPrerequisiteIds: readonly string[];
  readonly availabilityMonth: number;
  readonly monthsUntilAvailable: number;
  readonly discoveryWeight: number;
  readonly timingModifierBp: number;
  readonly drawWeight: number;
  readonly drawOddsBp: number | null;
}

export interface ResearchFieldProjection {
  readonly fieldId: string;
  readonly eligible: boolean;
  readonly totalTechs: number;
  readonly discoveredTechs: number;
  readonly activeTechId: string | null;
}

export interface ResearchScreenProjection {
  readonly nationId: string;
  readonly turnNumber: number;
  readonly lowSpending: boolean;
  readonly minimumResearchSpend: number;
  readonly technologies: readonly ResearchTechnologyProjection[];
  readonly fields: readonly ResearchFieldProjection[];
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
  technologyNames: ReadonlyMap<string, string> = new Map(),
): ResearchScreenProjection | undefined {
  const facts = derivePlayerFacts(state.snapshot, playerSlotId);
  if (facts === undefined) return undefined;

  const { outlook } = facts;
  const research = facts.nation.research;
  const fieldPriorities: Record<string, number> = {};
  for (const [fieldId, weight] of Object.entries(research.fieldPriorities)) {
    fieldPriorities[fieldId] = Number(weight);
  }

  const { technologies, fields } = projectTechnologyChart(state, research, technologyNames);

  return {
    nationId: research.nationId,
    turnNumber: Number(state.snapshot.turnNumber),
    lowSpending: isLowResearchSpending(outlook),
    minimumResearchSpend: Math.floor((outlook.revenue * MIN_RESEARCH_SHARE_BP) / 10_000),
    technologies,
    fields,
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

function projectTechnologyChart(
  state: CampaignState,
  research: ResearchState,
  names: ReadonlyMap<string, string>,
): Pick<ResearchScreenProjection, "technologies" | "fields"> {
  const turn = state.snapshot.turnNumber;
  const catalogue = technologyCatalogueOf(state.snapshot);
  const progress = new Map(research.technologies.map((t) => [t.techId, t] as const));
  const completed = new Set(research.technologies.filter((t) => t.completed).map((t) => t.techId));
  for (const id of research.discoveredTechs) completed.add(id);

  const openByField = new Map<string, Set<string>>();
  const oddsByTech = new Map<string, number>();
  for (const fieldId of CANONICAL_RESEARCH_FIELD_IDS) {
    const open = eligibleTechnologiesForField(
      fieldId,
      research.technologies,
      research.discoveredTechs,
      turn,
      catalogue,
    );
    openByField.set(fieldId, new Set(open.map((t) => t.techId)));
    if (research.activeCandidates.has(fieldId) || open.length === 0) continue;
    const weights = open.map(
      (t) =>
        [
          t.techId,
          Number(discoveryDrawWeight(t.discoveryWeight, t.availabilityMonth, turn)),
        ] as const,
    );
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    for (const [techId, weight] of weights) {
      oddsByTech.set(techId, Math.floor((weight * 10_000) / total));
    }
  }

  const active = new Set(research.activeCandidates.values());
  const technologies = [...catalogue.values()].map((def): ResearchTechnologyProjection => {
    const missing = def.prerequisites.filter((id) => !completed.has(id));
    const monthsUntilAvailable = Math.max(0, Number(def.availabilityMonth) - Number(turn));
    const status: ResearchTechStatus = completed.has(def.techId)
      ? "discovered"
      : active.has(def.techId)
        ? "researching"
        : missing.length > 0
          ? "locked"
          : monthsUntilAvailable > 0
            ? "future"
            : "open";
    return {
      techId: def.techId,
      name: names.get(def.techId) ?? null,
      researchFieldId: def.researchFieldId,
      status,
      cost: Number(def.cost),
      investedPoints: Number(progress.get(def.techId)?.investedPoints ?? 0),
      prerequisiteIds: [...def.prerequisites],
      missingPrerequisiteIds: missing,
      availabilityMonth: Number(def.availabilityMonth),
      monthsUntilAvailable,
      discoveryWeight: Number(def.discoveryWeight),
      timingModifierBp: historicalTimingModifierBp(def.availabilityMonth, turn),
      drawWeight: Number(discoveryDrawWeight(def.discoveryWeight, def.availabilityMonth, turn)),
      drawOddsBp: oddsByTech.get(def.techId) ?? null,
    };
  });

  const fields = CANONICAL_RESEARCH_FIELD_IDS.map((fieldId): ResearchFieldProjection => {
    const inField = technologies.filter((t) => t.researchFieldId === fieldId);
    return {
      fieldId,
      eligible: (openByField.get(fieldId)?.size ?? 0) > 0,
      totalTechs: inField.length,
      discoveredTechs: inField.filter((t) => t.status === "discovered").length,
      activeTechId: research.activeCandidates.get(fieldId) ?? null,
    };
  });

  return { technologies, fields };
}
