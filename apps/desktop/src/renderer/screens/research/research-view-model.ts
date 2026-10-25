import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
  type ResearchTechStatus,
  type ResearchTechnologyProjection,
} from "@bluewave/campaign-engine";
import { researchNote } from "../../lib/economy-wording.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { deriveProjectedResearchAllocations } from "./research-allocation.js";
import { monthLabel } from "./research-calendar.js";
import { monthsToCompletion } from "./research-eta.js";
import { draftHighCount, isDraftDirty } from "./research-field-priorities.js";
import type { ResearchScreenActiveData } from "./research-screen-state.js";

export type ResearchFieldState = "funded" | "unfunded" | "waiting" | "complete" | "empty";

export interface ResearchPrerequisiteView {
  readonly techId: string;
  readonly label: string;
  readonly status: ResearchTechStatus;
}

export interface ResearchTechView {
  readonly techId: string;
  readonly label: string;
  readonly fieldId: string;
  readonly status: ResearchTechStatus;
  readonly cost: number;
  readonly investedPoints: number;
  readonly progressPct: number;
  readonly prerequisites: readonly ResearchPrerequisiteView[];
  readonly missingPrerequisites: readonly string[];
  readonly monthsUntilAvailable: number;
  readonly availabilityLabel: string | null;
  readonly oddsPct: number | null;
  readonly discoveryWeight: number;
  readonly drawWeight: number;
  readonly timingModifierPct: number;
  readonly etaMonths: number | null;
  readonly queuedBehind: string | null;
}

export interface ResearchNextOpening {
  readonly techId: string;
  readonly label: string;
  readonly monthsUntil: number;
  readonly availabilityLabel: string;
}

export interface ResearchFieldView {
  readonly fieldId: string;
  readonly label: string;
  readonly weight: number;
  readonly weightLabel: string;
  readonly isHigh: boolean;
  readonly eligible: boolean;
  readonly projectedPoints: number;
  readonly sharePct: number;
  readonly totalTechs: number;
  readonly discoveredTechs: number;
  readonly state: ResearchFieldState;
  readonly stateNote: string;
  readonly activeTech: ResearchTechView | null;
  readonly nextOpening: ResearchNextOpening | null;
  readonly techs: readonly ResearchTechView[];
}

export interface ResearchBudgetView {
  readonly monthly: number;
  readonly annualAllocation: number | null;
  readonly cap: number;
  readonly floor: number;
  readonly utilizationPct: number;
  readonly floorPct: number;
  readonly lowSpending: boolean;
  readonly note: string | null;
}

export interface ResearchTotals {
  readonly catalogue: number;
  readonly discovered: number;
  readonly researching: number;
  readonly open: number;
  readonly projectedPoints: number;
  readonly fundedFields: number;
  readonly idleFields: number;
}

export interface ResearchViewModel {
  readonly budget: ResearchBudgetView;
  readonly totals: ResearchTotals;
  readonly fields: readonly ResearchFieldView[];
  readonly technologies: ReadonlyMap<string, ResearchTechView>;
  readonly highCount: number;
  readonly highCap: number;
  readonly highCountValid: boolean;
  readonly dirty: boolean;
}

const WEIGHT_LABELS: Readonly<Record<number, string>> = {
  [RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH]: "High",
  [RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM]: "Medium",
  [RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW]: "Low",
};

const percent = (part: number, whole: number) =>
  whole <= 0 ? 0 : Math.round((part * 100) / whole);

function techLabel(tech: { readonly techId: string; readonly name: string | null }): string {
  return tech.name ?? humanizeId(tech.techId);
}

function stateNoteFor(
  state: ResearchFieldState,
  nextOpening: ResearchNextOpening | null,
  activeLabel: string | null,
): string {
  switch (state) {
    case "empty":
      return "No technologies are authored for this field yet.";
    case "complete":
      return "Every technology in this field is discovered.";
    case "unfunded":
      return "Open for research, but the monthly budget is empty.";
    case "funded":
      return activeLabel === null
        ? "A technology is drawn from the open ones at the next turn advance."
        : `Researching ${activeLabel}.`;
    case "waiting":
      return nextOpening === null
        ? "Nothing is open yet: every technology waits on prerequisites. Its share flows to other fields."
        : `Nothing is open yet. ${nextOpening.label} opens in ${nextOpening.availabilityLabel}. Its share flows to other fields until then.`;
  }
}

export function buildResearchViewModel(state: ResearchScreenActiveData): ResearchViewModel {
  const { projection, draft } = state;
  const eligible = new Set(projection.fields.filter((f) => f.eligible).map((f) => f.fieldId));
  const projected = deriveProjectedResearchAllocations(projection.researchBudget, draft, eligible);
  const highCount = draftHighCount(draft);

  const byId = new Map(projection.technologies.map((t) => [t.techId, t] as const));
  const activeByField = new Map(projection.fields.map((f) => [f.fieldId, f.activeTechId] as const));

  const viewOf = (tech: ResearchTechnologyProjection): ResearchTechView => {
    const rate = projected[tech.researchFieldId] ?? 0;
    const activeId = activeByField.get(tech.researchFieldId) ?? null;
    const queuedBehind =
      tech.status === "open" && activeId !== null && byId.has(activeId)
        ? techLabel(byId.get(activeId)!)
        : null;
    return {
      techId: tech.techId,
      label: techLabel(tech),
      fieldId: tech.researchFieldId,
      status: tech.status,
      cost: tech.cost,
      investedPoints: tech.investedPoints,
      progressPct: Math.min(100, percent(tech.investedPoints, tech.cost)),
      prerequisites: tech.prerequisiteIds.map((id) => {
        const prerequisite = byId.get(id);
        return {
          techId: id,
          label: prerequisite === undefined ? humanizeId(id) : techLabel(prerequisite),
          status: prerequisite?.status ?? "locked",
        };
      }),
      missingPrerequisites: tech.missingPrerequisiteIds.map((id) => {
        const prerequisite = byId.get(id);
        return prerequisite === undefined ? humanizeId(id) : techLabel(prerequisite);
      }),
      monthsUntilAvailable: tech.monthsUntilAvailable,
      availabilityLabel:
        tech.monthsUntilAvailable > 0 ? monthLabel(state.month, tech.monthsUntilAvailable) : null,
      oddsPct: tech.drawOddsBp === null ? null : Math.round(tech.drawOddsBp / 100),
      discoveryWeight: tech.discoveryWeight,
      drawWeight: tech.drawWeight,
      timingModifierPct: Math.round(tech.timingModifierBp / 100),
      etaMonths:
        tech.status === "researching"
          ? monthsToCompletion(tech.cost, tech.investedPoints, rate)
          : null,
      queuedBehind,
    };
  };

  const technologies = new Map(projection.technologies.map((t) => [t.techId, viewOf(t)] as const));

  const fields = CANONICAL_RESEARCH_FIELD_IDS.map((fieldId): ResearchFieldView => {
    const summary = projection.fields.find((f) => f.fieldId === fieldId);
    const weight = draft[fieldId] ?? RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
    const projectedPoints = projected[fieldId] ?? 0;
    const techs = projection.technologies
      .filter((t) => t.researchFieldId === fieldId)
      .map((t) => technologies.get(t.techId)!);
    const totalTechs = summary?.totalTechs ?? techs.length;
    const discoveredTechs = summary?.discoveredTechs ?? 0;
    const isEligible = summary?.eligible ?? false;

    const state: ResearchFieldState =
      totalTechs === 0
        ? "empty"
        : discoveredTechs === totalTechs
          ? "complete"
          : isEligible
            ? projectedPoints > 0
              ? "funded"
              : "unfunded"
            : "waiting";

    const opening = techs
      .filter((t) => t.status === "future" && t.missingPrerequisites.length === 0)
      .sort((a, b) => a.monthsUntilAvailable - b.monthsUntilAvailable)[0];
    const nextOpening: ResearchNextOpening | null =
      opening === undefined || opening.availabilityLabel === null
        ? null
        : {
            techId: opening.techId,
            label: opening.label,
            monthsUntil: opening.monthsUntilAvailable,
            availabilityLabel: opening.availabilityLabel,
          };

    const activeId = summary?.activeTechId ?? null;
    const activeTech = activeId === null ? null : (technologies.get(activeId) ?? null);

    return {
      fieldId,
      label: humanizeId(fieldId),
      weight,
      weightLabel: WEIGHT_LABELS[weight] ?? "Low",
      isHigh: weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
      eligible: isEligible,
      projectedPoints,
      sharePct: percent(projectedPoints, projection.researchBudget),
      totalTechs,
      discoveredTechs,
      state,
      stateNote: stateNoteFor(state, nextOpening, activeTech?.label ?? null),
      activeTech,
      nextOpening,
      techs,
    };
  });

  const counts = (status: ResearchTechStatus) =>
    projection.technologies.filter((t) => t.status === status).length;
  const projectedTotal = fields.reduce((sum, f) => sum + f.projectedPoints, 0);

  return {
    budget: {
      monthly: projection.researchBudget,
      annualAllocation: projection.annualAllocation,
      cap: projection.researchCap,
      floor: projection.minimumResearchSpend,
      utilizationPct: Math.min(100, percent(projection.researchBudget, projection.researchCap)),
      floorPct: Math.min(100, percent(projection.minimumResearchSpend, projection.researchCap)),
      lowSpending: projection.lowSpending,
      note: researchNote({
        researchCap: projection.researchCap,
        researchRequested: projection.researchBudget,
        researchUnfundedReason: projection.unfundedReason ?? undefined,
      }),
    },
    totals: {
      catalogue: projection.technologies.length,
      discovered: counts("discovered"),
      researching: counts("researching"),
      open: counts("open"),
      projectedPoints: projectedTotal,
      fundedFields: fields.filter((f) => f.projectedPoints > 0).length,
      idleFields: fields.filter((f) => f.state === "waiting").length,
    },
    fields,
    technologies,
    highCount,
    highCap: MAX_HIGH_PRIORITY_FIELDS,
    highCountValid: highCount >= 1 && highCount <= MAX_HIGH_PRIORITY_FIELDS,
    dirty: isDraftDirty(projection, draft),
  };
}
