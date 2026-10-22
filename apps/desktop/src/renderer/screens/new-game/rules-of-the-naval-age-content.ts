import type { NewGameScenario } from "../../../shared/new-game-contract.js";
import { monthName } from "../../lib/campaign-month.js";

export const RULES_OF_THE_NAVAL_AGE_HEADING = "Rules of the Naval Age";
export const RULES_OF_THE_NAVAL_AGE_HINT =
  "Set the era, scale, and historical uncertainty for this campaign.";

export function scenarioEraDescription(scenario: NewGameScenario): string {
  const month = monthName(scenario.startMonth) ?? String(scenario.startMonth);
  const nations = scenario.participantNationIds.length;
  return `Begins ${month} ${scenario.startYear} · ${nations} ${nations === 1 ? "nation" : "nations"}`;
}

export type UncertaintyField =
  | "researchSpeed"
  | "technologyVariation"
  | "historicalBudget"
  | "tacticalRealism"
  | "difficulty";

export const UNCERTAINTY_FIELDS: readonly UncertaintyField[] = [
  "researchSpeed",
  "technologyVariation",
  "historicalBudget",
  "tacticalRealism",
  "difficulty",
];

export const UNCERTAINTY_FIELD_LABELS: Record<UncertaintyField, string> = {
  researchSpeed: "Research Pace",
  technologyVariation: "Technology Variation",
  historicalBudget: "Historical Budget",
  tacticalRealism: "Tactical Realism",
  difficulty: "Difficulty",
};

interface SettingValueContent {
  readonly label: string;
  readonly blurb: string;
}

const UNCERTAINTY_VALUE_CONTENT: Record<UncertaintyField, Record<string, SettingValueContent>> = {
  researchSpeed: {
    slow: {
      label: "Slow",
      blurb: "Technologies arrive less frequently — a deliberate, historically grounded pace.",
    },
    standard: { label: "Standard", blurb: "Recommended historical progression." },
    fast: {
      label: "Fast",
      blurb: "More rapid changes in fleet design keep your yards busy retooling.",
    },
    very_fast: {
      label: "Very Fast",
      blurb:
        "Technologies arrive in a rush — expect your fleet to feel outdated within a few years of launch.",
    },
  },
  technologyVariation: {
    none: {
      label: "Historical",
      blurb: "Technologies generally become available around their historical periods.",
    },
    some: {
      label: "Uncertain",
      blurb:
        "Technologies may arrive somewhat earlier or later, and some systems may work differently than expected.",
    },
    considerable: {
      label: "Alternate History",
      blurb:
        "Technology dates and effectiveness vary considerably — historically successful ideas may not necessarily dominate.",
    },
  },
  historicalBudget: {
    standard: {
      label: "Standard",
      blurb:
        "Naval budgets follow the era's typical economic rhythms — moderate, predictable growth.",
    },
    historical: {
      label: "Historical",
      blurb:
        "Naval budgets track their real historical trajectory, including the downturns and crash-program surges that actually occurred.",
    },
  },
  tacticalRealism: {
    standard: {
      label: "Standard",
      blurb: "Battle outcomes lean on streamlined, gameplay-friendly resolution.",
    },
    realistic: {
      label: "Realistic",
      blurb:
        "Battle outcomes hew closer to period-accurate tactics and their consequences, for better or worse.",
    },
    not_applicable: {
      label: "Not Applicable",
      blurb:
        "This era's engagements don't use tactical-realism modeling — this setting has no effect.",
    },
  },
  difficulty: {
    easy: {
      label: "Easy",
      blurb: "A forgiving campaign — rivals build and react more slowly, giving you room to learn.",
    },
    normal: {
      label: "Normal",
      blurb:
        "A balanced challenge, calibrated for players familiar with the basics of naval administration.",
    },
    hard: {
      label: "Hard",
      blurb: "Rivals are sharper and less forgiving of strategic missteps.",
    },
    very_hard: {
      label: "Very Hard",
      blurb:
        "An unforgiving campaign — rivals press every advantage, and mistakes compound quickly.",
    },
  },
};

export function uncertaintyValueContent(
  field: UncertaintyField,
  valueId: string,
): SettingValueContent {
  return UNCERTAINTY_VALUE_CONTENT[field][valueId] ?? { label: valueId, blurb: "" };
}

export const FLEET_SIZE_READOUTS: Record<string, string> = {
  small: "Reduced fleet — faster turns, fewer ships to manage.",
  standard: "Recommended default — a balanced fleet for most players.",
  large: "Expanded fleet — more ships to manage, slower turns.",
  very_large: "Sprawling fleet — the most ships to manage, and the slowest turns.",
};

export const FLEET_SIZE_FIELD_LABEL = "Fleet Size";

export const FLEET_SIZE_LABELS: Record<string, string> = {
  small: "Small",
  standard: "Standard",
  large: "Large",
  very_large: "Very Large",
};

export function fleetSizeReadout(valueId: string): string {
  return FLEET_SIZE_READOUTS[valueId] ?? "";
}

export function fleetSizeLabel(valueId: string): string {
  return FLEET_SIZE_LABELS[valueId] ?? valueId;
}
