import {
  ARCHETYPE_DIMENSION_MAX,
  ARCHETYPE_DIMENSION_MIN,
  ARCHETYPE_DIMENSIONS,
  ARCHETYPE_POINT_TOTAL,
  BALANCED_ALLOCATION,
  allocationTotal,
  archetypeEffects,
  differenceFromBalanced,
  type ArchetypeAllocation,
  type ArchetypeDimension,
  type ArchetypeEffects,
} from "@bluewave/campaign-engine";
import { archetypeDimensionLabel } from "./archetype-dimensions.js";

const DIMENSION_SYSTEMS: Record<ArchetypeDimension, string> = {
  economy: "Starting treasury and monthly appropriation",
  industry: "Shipyard capacity (construction-throughput ceiling)",
  combat: "Commander and doctrine bonus in battle resolution",
};

export interface ArchetypeNumericEffect {
  readonly label: string;
  readonly value: string;
  readonly kind: "multiplier" | "bonus" | "plain";
}

export interface ArchetypeConsequence {
  readonly totalPoints: number;
  readonly isBalanced: boolean;
  readonly effects: ArchetypeEffects;
  readonly difference: ArchetypeAllocation;
  readonly dimensionDeltas: readonly {
    readonly dimension: ArchetypeDimension;
    readonly label: string;
    readonly invested: number;
    readonly balanced: number;
    readonly delta: number;
  }[];
  readonly strengths: readonly string[];
  readonly opportunityCosts: readonly string[];
  readonly systems: readonly string[];
  readonly numericEffects: readonly ArchetypeNumericEffect[];
  readonly thresholds: readonly string[];
}

function percent(value: number): string {
  const shifted = value - 1;
  const rounded = Math.round(shifted * 100);
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function signedNumber(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}

/**
 * Builds the concrete consequence preview for an allocation. Every numeric effect is
 * derived from the engine's authoritative calculators; React only renders it.
 */
export function buildArchetypeConsequence(allocation: ArchetypeAllocation): ArchetypeConsequence {
  const effects = archetypeEffects(allocation);
  const difference = differenceFromBalanced(allocation);
  const totalPoints = allocationTotal(allocation);

  const dimensionDeltas = ARCHETYPE_DIMENSIONS.map((dimension) => ({
    dimension,
    label: archetypeDimensionLabel(dimension),
    invested: allocation[dimension],
    balanced: BALANCED_ALLOCATION[dimension],
    delta: difference[dimension],
  }));

  const strengths: string[] = [];
  const opportunityCosts: string[] = [];

  for (const dimension of dimensionDeltas) {
    if (dimension.delta > 0) {
      strengths.push(`${dimension.label}: ${signedNumber(dimension.delta)} points above balanced`);
    } else if (dimension.delta < 0) {
      opportunityCosts.push(
        `${dimension.label}: ${signedNumber(dimension.delta)} points below balanced`,
      );
    }
  }

  const systems = ARCHETYPE_DIMENSIONS.map(
    (dimension) => `${archetypeDimensionLabel(dimension)} — ${DIMENSION_SYSTEMS[dimension]}`,
  );

  const numericEffects: ArchetypeNumericEffect[] = [
    {
      label: "Starting treasury",
      value: percent(effects.treasuryMultiplier),
      kind: "multiplier",
    },
    {
      label: "Monthly appropriation",
      value: percent(effects.appropriationMultiplier),
      kind: "multiplier",
    },
    {
      label: "Shipyard capacity",
      value: percent(effects.shipyardMultiplier),
      kind: "multiplier",
    },
    {
      label: "Commander bonus in battle",
      value: signedNumber(effects.commanderBonus),
      kind: "bonus",
    },
    {
      label: "Doctrine bonus in battle",
      value: signedNumber(effects.doctrineBonus),
      kind: "bonus",
    },
  ];

  const thresholds: string[] = [
    `Each dimension is bounded between ${ARCHETYPE_DIMENSION_MIN} and ${ARCHETYPE_DIMENSION_MAX} points; effects stop growing at the cap and start shrinking where the allocation falls below balanced.`,
    `All ${ARCHETYPE_POINT_TOTAL} points must be allocated before the campaign can start.`,
  ];

  return {
    totalPoints,
    isBalanced: difference.economy === 0 && difference.industry === 0 && difference.combat === 0,
    effects,
    difference,
    dimensionDeltas,
    strengths,
    opportunityCosts,
    systems,
    numericEffects,
    thresholds,
  };
}
