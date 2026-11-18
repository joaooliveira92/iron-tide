import { FORCE_MORALE_MAX_BP, type ForceOrderRuleset } from "./forceConstants.js";

const BP = 10_000;

export interface ForceSituation {
  readonly casualtyBp: number;
  readonly ammunitionBp: number | null;
}

export interface RallyBoost {
  readonly remainingBp: number;
  readonly stepBp: number;
}

export interface ForceMoraleTrack {
  readonly moraleBp: number;
  readonly boosts: readonly RallyBoost[];
}

export function rallyAmountBp(situation: ForceSituation, ruleset: ForceOrderRuleset): number {
  let amount = ruleset.rallyAmountBp;
  if (situation.casualtyBp >= ruleset.heavyCasualtyBp) {
    amount = Math.floor((amount * ruleset.heavyCasualtyRallyBp) / BP);
  }
  if (situation.ammunitionBp !== null && situation.ammunitionBp < ruleset.lowAmmunitionBp) {
    amount = Math.floor((amount * ruleset.lowAmmunitionRallyBp) / BP);
  }
  return amount;
}

export function decayRally(track: ForceMoraleTrack): ForceMoraleTrack {
  let moraleBp = track.moraleBp;
  const boosts: RallyBoost[] = [];
  for (const boost of track.boosts) {
    const drop = Math.min(boost.stepBp, boost.remainingBp);
    moraleBp -= drop;
    const remainingBp = boost.remainingBp - drop;
    if (remainingBp > 0) boosts.push({ remainingBp, stepBp: boost.stepBp });
  }
  return { moraleBp, boosts };
}

export function applyRally(
  track: ForceMoraleTrack,
  situation: ForceSituation,
  ruleset: ForceOrderRuleset,
): ForceMoraleTrack {
  const gain = Math.min(rallyAmountBp(situation, ruleset), FORCE_MORALE_MAX_BP - track.moraleBp);
  if (gain <= 0) return track;
  return {
    moraleBp: track.moraleBp + gain,
    boosts: [
      ...track.boosts,
      { remainingBp: gain, stepBp: Math.ceil(gain / ruleset.rallyDecayMinutes) },
    ],
  };
}
