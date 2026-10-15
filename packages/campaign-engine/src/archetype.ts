/**
 * Archetype selection lets the player weight a new campaign across three
 * dimensions with a fixed point budget. Formulas here are pinned by
 * pre-existing application tests
 * (`apps/desktop/src/renderer/screens/new-game/archetype-consequence.test.ts`,
 * `new-game-archetype-screen-state.test.ts`) that predate this package —
 * reverse-engineered from their exact expected values, not invented.
 * Whether `archetypeEffects`' multipliers get applied when `compileCampaign`
 * builds the starting `CampaignConfiguration` is a decision for the ticket
 * implementing that command, not this module.
 */

import { canonicalSerialize } from "@bluewave/deterministic";

export type ArchetypeDimension = "economy" | "industry" | "combat";

export interface ArchetypeAllocation {
  readonly economy: number;
  readonly industry: number;
  readonly combat: number;
}

export type ArchetypeSelection =
  | { readonly kind: "preset"; readonly id: string; readonly allocation: ArchetypeAllocation }
  | { readonly kind: "custom"; readonly allocation: ArchetypeAllocation };

export interface ArchetypePreset {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly allocation: ArchetypeAllocation;
}

export const ARCHETYPE_DIMENSIONS: readonly ArchetypeDimension[] = [
  "economy",
  "industry",
  "combat",
];

export const ARCHETYPE_POINT_TOTAL = 20;

// Not directly pinned by an existing test; chosen to keep every known
// preset and the balanced baseline valid. Revisit if a hidden expectation
// surfaces during ticket 12.
export const ARCHETYPE_DIMENSION_MIN = 2;
export const ARCHETYPE_DIMENSION_MAX = 12;

export const BALANCED_ALLOCATION: ArchetypeAllocation = {
  economy: 7,
  industry: 7,
  combat: 6,
};

export const ARCHETYPE_PRESETS: readonly ArchetypePreset[] = [
  {
    id: "merchant_prince",
    name: "Merchant Prince",
    tagline: "Treasury first",
    description:
      "Leans on trade and treasury growth, funding a navy through commerce rather than industrial scale.",
    allocation: { economy: 10, industry: 5, combat: 5 },
  },
  {
    id: "shipyard_baron",
    name: "Shipyard Baron",
    tagline: "Industrial scale",
    description:
      "Prioritizes shipyard capacity and construction throughput over treasury or combat doctrine.",
    allocation: { economy: 5, industry: 10, combat: 5 },
  },
  {
    id: "grand_admiral",
    name: "Grand Admiral",
    tagline: "Doctrine and battle",
    description:
      "Favors commander and doctrine bonuses in battle resolution, at the expense of economic growth.",
    allocation: { economy: 5, industry: 5, combat: 10 },
  },
];

export function findPreset(id: string): ArchetypePreset | undefined {
  return ARCHETYPE_PRESETS.find((preset) => preset.id === id);
}

export function allocationTotal(allocation: ArchetypeAllocation): number {
  return allocation.economy + allocation.industry + allocation.combat;
}

export function differenceFromBalanced(allocation: ArchetypeAllocation): ArchetypeAllocation {
  return {
    economy: allocation.economy - BALANCED_ALLOCATION.economy,
    industry: allocation.industry - BALANCED_ALLOCATION.industry,
    combat: allocation.combat - BALANCED_ALLOCATION.combat,
  };
}

export function validateArchetypeAllocation(allocation: ArchetypeAllocation): {
  readonly ok: boolean;
  readonly diagnostics: readonly string[];
} {
  const diagnostics: string[] = [];

  for (const dimension of ARCHETYPE_DIMENSIONS) {
    const value = allocation[dimension];
    if (value < ARCHETYPE_DIMENSION_MIN || value > ARCHETYPE_DIMENSION_MAX) {
      diagnostics.push(
        `${dimension} must be between ${ARCHETYPE_DIMENSION_MIN} and ${ARCHETYPE_DIMENSION_MAX} (was ${value}).`,
      );
    }
  }

  const total = allocationTotal(allocation);
  if (total !== ARCHETYPE_POINT_TOTAL) {
    diagnostics.push(`allocation totals ${total}, expected ${ARCHETYPE_POINT_TOTAL}.`);
  }

  return { ok: diagnostics.length === 0, diagnostics };
}

/** Percentage-point shift applied to the economy dimension's multipliers, per point of delta from balanced. */
const ECONOMY_MULTIPLIER_STEP = 0.08;
/** Percentage-point shift applied to the industry dimension's multiplier, per point of delta from balanced. */
const INDUSTRY_MULTIPLIER_STEP = 0.08;
/** Flat bonus applied per point of combat delta from balanced. */
const COMMANDER_BONUS_STEP = 5;
/** Flat bonus applied per point of combat delta from balanced — distinct
 * from the commander step so the two don't coincidentally collide. */
const DOCTRINE_BONUS_STEP = 4;

export interface ArchetypeEffects {
  readonly treasuryMultiplier: number;
  readonly appropriationMultiplier: number;
  readonly shipyardMultiplier: number;
  readonly commanderBonus: number;
  readonly doctrineBonus: number;
}

export function archetypeEffects(allocation: ArchetypeAllocation): ArchetypeEffects {
  const delta = differenceFromBalanced(allocation);
  return {
    treasuryMultiplier: 1 + ECONOMY_MULTIPLIER_STEP * delta.economy,
    appropriationMultiplier: 1 + ECONOMY_MULTIPLIER_STEP * delta.economy,
    shipyardMultiplier: 1 + INDUSTRY_MULTIPLIER_STEP * delta.industry,
    commanderBonus: COMMANDER_BONUS_STEP * delta.combat,
    doctrineBonus: DOCTRINE_BONUS_STEP * delta.combat,
  };
}

export function defaultArchetypeSelection(): ArchetypeSelection {
  return { kind: "custom", allocation: BALANCED_ALLOCATION };
}

export function serializeArchetypeSelection(selection: ArchetypeSelection): string {
  // Canonical serialization, not insertion order: the byte shape is defined by
  // the versioned serializer's key ordering (RULES.md "Determinism").
  return canonicalSerialize(selection);
}
