/**
 * National design and procurement policy (docs/ships-nation-orientation.md §8): national identity must change what
 * the AI *values*, not just names. Two pure pieces:
 *
 *  - `scoreDesign` — a weighted utility over ship facts, using role-specific national weights;
 *  - `planProcurement` — a deterministic procurement order derived from the profile's shares and build order.
 *
 * Both are pure and integer-only. Bounded randomness supplies ±5–10% variation around the doctrine weights, seeded
 * by the campaign, so two campaigns differ while a single campaign stays reproducible (the determinism contract).
 */
import { RandomEngine } from "@bluewave/random";
import type { DesignWeights, NationNavalProfile } from "./nationProfile.js";
import type { ShipTypeId } from "./shipTypes.js";

/** A neutral 10000 bp on every axis: the arithmetic identity, for tests and defaults. */
export const NEUTRAL_DESIGN_WEIGHTS: DesignWeights = {
  firepowerBp: 10_000,
  protectionBp: 10_000,
  speedBp: 10_000,
  enduranceBp: 10_000,
  torpedoBp: 10_000,
  reliabilityBp: 10_000,
  colonialBp: 10_000,
  costBp: 10_000,
};

/** ±10% variation band (the brief's 5–10%; 1000 bp = 10%). */
export const VARIATION_SPAN_BP = 1000;

/**
 * Vary doctrine weights by a bounded, seeded amount. Deterministic for a given (nation, type, seed): the same
 * campaign reproduces the same national character, a different campaign gets a slightly different one.
 */
export function varyDesignWeights(
  weights: DesignWeights,
  nationId: string,
  type: ShipTypeId,
  seed: string,
): DesignWeights {
  const stream = new RandomEngine(seed).stream(`national-identity:${nationId}:${type}`);
  const vary = (bp: number): number => {
    const f = stream.next(); // [0,1)
    const delta = Math.round((f * 2 - 1) * VARIATION_SPAN_BP);
    return Math.max(1, bp + delta);
  };
  return {
    firepowerBp: vary(weights.firepowerBp),
    protectionBp: vary(weights.protectionBp),
    speedBp: vary(weights.speedBp),
    enduranceBp: vary(weights.enduranceBp),
    torpedoBp: vary(weights.torpedoBp),
    reliabilityBp: vary(weights.reliabilityBp),
    colonialBp: vary(weights.colonialBp),
    costBp: vary(weights.costBp),
  };
}

/** The effective weights for a nation/type, optionally with campaign-seeded variation applied. */
export function effectiveDesignWeights(
  profile: NationNavalProfile,
  type: ShipTypeId,
  seed?: string,
): DesignWeights {
  const base = profile.designWeights[type] ?? NEUTRAL_DESIGN_WEIGHTS;
  return seed === undefined ? base : varyDesignWeights(base, profile.nationId, type, seed);
}

/** Ship facts a design score is computed from; all bp scores are 0..20000 (10000 = a neutral reference ship). */
export interface DesignScoreFacts {
  readonly firepowerBp: number;
  readonly protectionBp: number;
  readonly speedBp: number;
  readonly enduranceBp: number;
  readonly torpedoBp: number;
  readonly reliabilityBp: number;
  readonly colonialBp: number;
  /** Cost in treasury units. */
  readonly costUnits: number;
  /** Expected build time in months. */
  readonly buildMonths: number;
  /** Overweight vs design target, bp (stability/penalty input). */
  readonly overweightBp: number;
  /** Obsolescence risk, bp (how near the end of its relevance the type is). */
  readonly obsolescenceBp: number;
}

/**
 * Weighted utility: positive terms are weights × facts (occupying the integer range), penalties subtract. Deterministic
 * integer arithmetic; the absolute value is meaningless, only the ordering across candidates matters.
 */
export function scoreDesign(weights: DesignWeights, f: DesignScoreFacts): number {
  const positive =
    weights.firepowerBp * f.firepowerBp +
    weights.protectionBp * f.protectionBp +
    weights.speedBp * f.speedBp +
    weights.enduranceBp * f.enduranceBp +
    weights.torpedoBp * f.torpedoBp +
    weights.reliabilityBp * f.reliabilityBp +
    weights.colonialBp * f.colonialBp;
  const weightedPositive = Math.floor(positive / 10_000);
  const costPenalty = Math.floor((weights.costBp * Math.max(0, f.costUnits)) / 10_000);
  const buildPenalty = Math.floor((weights.costBp * Math.max(0, f.buildMonths)) / 100);
  const instabilityPenalty = Math.max(0, f.overweightBp) + Math.max(0, f.obsolescenceBp);
  return weightedPositive - costPenalty - buildPenalty - instabilityPenalty;
}

/** Rank candidates for a nation: highest score first, ties broken by designId so the order is stable. */
export function rankCandidatesForNation<
  T extends { readonly designId: string; readonly facts: DesignScoreFacts },
>(candidates: readonly T[], weights: DesignWeights): readonly T[] {
  return [...candidates].sort((a, b) => {
    const sa = scoreDesign(weights, a.facts);
    const sb = scoreDesign(weights, b.facts);
    if (sa !== sb) return sb - sa;
    return a.designId < b.designId ? -1 : a.designId > b.designId ? 1 : 0;
  });
}

export interface ProcurementCandidate {
  readonly designId: string;
  readonly type: ShipTypeId;
  /** Cost in treasury units. */
  readonly costUnits: number;
  /** Score from `scoreDesign` under the nation's role weights. */
  readonly score: number;
}

export interface ProcurementPlan {
  /** Chosen designs, in the order they should be laid down. */
  readonly order: readonly string[];
  readonly totalCostUnits: number;
}

/**
 * A deterministic procurement plan: walk the profile's `buildOrder`, and within each type take the best-scoring
 * affordable candidate up to the type's share of the budget. Never overspends. The plan is a *soft* preference:
 * an unaffordable or empty type is simply skipped, not an error.
 */
export function planProcurement(
  profile: NationNavalProfile,
  candidates: readonly ProcurementCandidate[],
  budgetUnits: number,
): ProcurementPlan {
  const byType = new Map<ShipTypeId, ProcurementCandidate[]>();
  for (const c of candidates) {
    const list = byType.get(c.type) ?? [];
    list.push(c);
    byType.set(c.type, list);
  }
  for (const list of byType.values())
    list.sort((a, b) => b.score - a.score || (a.designId < b.designId ? -1 : 1));

  const shareOf: Record<ShipTypeId, number> = {
    B: profile.procurementPolicy.battleLineShareBp,
    CA: profile.procurementPolicy.cruiserShareBp,
    CL: profile.procurementPolicy.cruiserShareBp,
    DD: profile.procurementPolicy.torpedoCraftShareBp,
    KE: profile.procurementPolicy.colonialShareBp,
    AMC: profile.procurementPolicy.colonialShareBp,
    BB: 0,
    BC: 0,
    CV: 0,
    CVL: 0,
    AV: 0,
    SS: 0,
    MTB: 0,
    TR: 0,
  };
  const totalShare = Object.values(shareOf).reduce((a, b) => a + b, 0) || 1;

  const order: string[] = [];
  let spent = 0;
  for (const type of profile.procurementPolicy.buildOrder) {
    const cap = Math.floor((budgetUnits * shareOf[type]) / totalShare);
    let typeSpent = 0;
    for (const c of byType.get(type) ?? []) {
      if (spent + c.costUnits > budgetUnits) break;
      if (typeSpent + c.costUnits > cap) break;
      order.push(c.designId);
      spent += c.costUnits;
      typeSpent += c.costUnits;
    }
  }
  return { order, totalCostUnits: spent };
}
