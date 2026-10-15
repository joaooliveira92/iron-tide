import { BluewaveError } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";

export const BATTLE_TURN_AWAY_TECH = "battle_turn_away_maneuver" as const;
export const DOCTRINE_REQUIRES_TRAINING = "DOCTRINE_REQUIRES_TRAINING" as const;
export const REQUIRED_PAID_TRAINING_MONTHS = 6 as const;
export const MIN_COHESION = 40 as const;

export interface DivisionTurnAwayState {
  divisionId: string;
  cohesion: number;
  formation: string;
  isCommandCapable: boolean;
  acknowledged: boolean;
  isWithdrawal: boolean;
  isCollision: boolean;
  isGrounding: boolean;
  isImmobilized: boolean;
  hasManeuverRoom: boolean;
  turningCapabilityOk: boolean;
  ships: string[]; // ordered
  course: number; // degrees
}

export function assertTechnologyAvailable(hasTech: boolean, paidMonths: number) {
  if (!hasTech || paidMonths < 6)
    throw new BluewaveError("BATTLE_TURN_AWAY_TECHNOLOGY_UNAVAILABLE", {
      code: "BATTLE_TURN_AWAY_TECHNOLOGY_UNAVAILABLE",
      hasTech,
      paidMonths,
    });
}
export function assertEligibility(divs: DivisionTurnAwayState[]) {
  for (const d of divs) {
    if (d.formation !== "LINE_AHEAD" && d.formation !== "BATTLE_LINE_COMPATIBLE")
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        divisionId: d.divisionId,
        reason: "formation",
      });
    if (!d.isCommandCapable)
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        reason: "command",
      });
    if (!d.acknowledged)
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        reason: "acknowledge",
      });
    if (d.cohesion < 40)
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        reason: "cohesion",
      });
    if (d.isWithdrawal || d.isCollision || d.isGrounding || d.isImmobilized)
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        reason: "state",
      });
    if (!d.hasManeuverRoom)
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        reason: "room",
      });
    if (!d.turningCapabilityOk)
      throw new BluewaveError("BATTLE_TURN_AWAY_INELIGIBLE", {
        code: "BATTLE_TURN_AWAY_INELIGIBLE",
        reason: "turning",
      });
  }
}

export function executeManeuver(
  ships: string[],
  course: number,
  turnDirection: "PORT" | "STARBOARD",
) {
  const locked = [...ships];
  const reciprocal = (course + 180) % 360;
  const reversed = [...locked].reverse(); // [A,B,C,D]->[D,C,B,A]
  return {
    locked,
    reciprocalCourse: reciprocal,
    newOrder: reversed,
    turnDirection,
    protectedTurningPoints: locked.map((_, i) => i),
  };
}

export function computeInitiationIntervalMinutes(p: {
  formationDifficultyBp: number;
  damageMultiplierBp: number;
  confusionMultiplierBp: number;
}): number {
  const raw = Math.ceil(
    (1 * p.formationDifficultyBp * p.damageMultiplierBp * p.confusionMultiplierBp) /
      (10_000 * 10_000 * 10_000),
  );
  return Math.max(1, Math.min(4, raw));
}

// confusion
export function computeConfusionProbabilityBp(p: {
  signalDelayMinutes?: number;
  flagshipDegraded?: boolean;
  flagshipMissionKilled?: boolean;
  heavySmokeOrVisibilityBelow2nm?: boolean;
  mixedDivision?: boolean;
  fatigue?: number;
  commanderAbility?: number;
  divisionExperience?: number;
  divisionCohesion?: number;
}): number {
  let prob = 1_500;
  if ((p.signalDelayMinutes ?? 0) > 1) prob += 500 * Math.floor(p.signalDelayMinutes! - 1);
  if (p.flagshipDegraded) prob += 1_000;
  if (p.flagshipMissionKilled) prob += 2_500;
  if (p.heavySmokeOrVisibilityBelow2nm) prob += 1_500;
  if (p.mixedDivision) prob += 500;
  if (p.fatigue !== undefined) {
    if (p.fatigue >= 80) prob += 1_000;
    else if (p.fatigue >= 60) prob += 500;
  }
  if (p.commanderAbility !== undefined && p.commanderAbility > 60)
    prob -= Math.min(1_000, Math.floor((p.commanderAbility - 60) * 25));
  if (p.divisionExperience !== undefined)
    prob -= Math.min(1_000, Math.floor(p.divisionExperience * 10));
  if (p.divisionCohesion !== undefined)
    prob -= Math.min(1_000, Math.floor(p.divisionCohesion * 10));
  return Math.max(0, Math.min(10_000, prob));
}

export const CONFUSION_OUTCOMES = [
  {
    kind: "EXECUTION_DELAYED",
    weight: 5_000,
    effect: "add exactly 2 tactical minutes before initiation",
  },
  {
    kind: "WRONG_TURN_DIRECTION_CORRECTED",
    weight: 2_000,
    effect: "lead ship begins wrong direction for one minute then corrects",
  },
  {
    kind: "FORMATION_INTERVAL_DOUBLED",
    weight: 2_000,
    effect: "final initiation interval *20_000bp",
  },
  {
    kind: "ONE_SHIP_FAILS_TO_ACKNOWLEDGE",
    weight: 750,
    effect: "select eligible ship by keyed choice; maintains previous order",
  },
  { kind: "MANEUVER_ABORTED", weight: 250, effect: "no ship begins, command fails" },
] as const;

export function selectConfusionOutcome(
  engine: RandomEngine,
  battleId: string,
  divisionId: string,
  attempt = 0,
): (typeof CONFUSION_OUTCOMES)[number] {
  const stream = engine.stream(
    `battle/command/division/battle_turn_away_confusion:${battleId}:${divisionId}:${attempt}`,
  );
  const roll = Math.floor(stream.next() * 10_000);
  let cum = 0;
  for (const o of CONFUSION_OUTCOMES) {
    cum += o.weight;
    if (roll < cum) return o;
  }
  // fallback is unreachable (weights total 10_000) but required for type safety
  const last = CONFUSION_OUTCOMES[CONFUSION_OUTCOMES.length - 1];
  if (!last)
    throw new BluewaveError("BATTLE_TURN_AWAY_CONFUSION", { code: "BATTLE_TURN_AWAY_CONFUSION" });
  return last;
}

export function isConfusionDirectDamage(): false {
  return false;
} // MUST NOT directly cause damage

export function assertCancellationAllowed(hasInitiated: boolean) {
  if (hasInitiated)
    throw new BluewaveError("BATTLE_TURN_AWAY_ABORTED: cancellation after initiation prohibited", {
      code: "BATTLE_TURN_AWAY_ABORTED",
      hasInitiated,
    });
}
