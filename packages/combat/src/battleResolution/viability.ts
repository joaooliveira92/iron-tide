// B-6 INC-2: side-viability predicate + §32 battle-end decision for the
// auto-resolver (DESIGN-38 §32 precedence; AC-6/AC-7).
//
// A side is ELIMINATED (`no_viable_combatants`) when ALL of its combatants are
// non-viable: terminal (SINKING/FOUNDERED) or hull-structure exhausted
// (structuralIntegrity <= 0 AND flotationReserve <= 0) — DESIGN-41 terminal
// seam semantics. The battle-end reason follows BATTLE_END_PRECEDENCE via
// `evaluateBattleEnd`; the ONLY precedence slots reachable from this slice are
// `no_viable_combatants`, `withdrawal_complete`, `mutual_disengagement` (ADR-0073
// fleet-strength predicate) and `time_limit` (scenario-terminal / objective
// predicates report false — never invented here).
//
// Deterministic tie-break (recorded in ADR-0026): when BOTH sides become
// non-viable in the same minute, the battle ends with reason
// `no_viable_combatants` and NO winner (`winnerId`/`loserId` null) — a plain
// derivable tie, no human judgment required.
import { BluewaveError } from "@bluewave/contracts";
import { evaluateBattleEnd } from "../battleEnd.js";
import { type ShipDamageState } from "../damage/state.js";
import { FLOAT_UNIT, STRUCTURE_UNIT, WITHDRAWAL_STRENGTH_THRESHOLD_BP } from "./constants.js";
import { hpOfState } from "./damage.js";
import { BATTLE_VIABILITY_EVALUATION_FAILED } from "./reasonCodes.js";

export type BattleSide = "ATTACKER" | "DEFENDER";

/** One ship's viability surface (projected unit + its damage state). */
export interface ShipViability {
  assetId: string;
  sideId: BattleSide;
  damageState: ShipDamageState;
}

/** A ship is non-viable when terminally damaged or structure+flotation are
 *  fully exhausted (hull gone). */
export function isShipNonViable(ship: ShipViability): boolean {
  const s = ship.damageState;
  if (s.terminalStatus !== "NORMAL") return true;
  return s.structuralIntegrity <= 0 && s.flotationReserve <= 0;
}

/** Whether the given side is eliminated (all its ships non-viable).
 *  An empty side fails closed — the projector never emits one. */
export function sideEliminated(ships: readonly ShipViability[], sideId: BattleSide): boolean {
  const sideShips = ships.filter((s) => s.sideId === sideId);
  if (sideShips.length === 0) {
    throw new BluewaveError(BATTLE_VIABILITY_EVALUATION_FAILED, {
      code: BATTLE_VIABILITY_EVALUATION_FAILED,
      sideId,
      reason: "side has no ships to evaluate — the projection must not produce an empty side",
    });
  }
  return sideShips.every((s) => isShipNonViable(s));
}

/** Per-ship strength in bp (0..10_000): the ADR-0026 hp mapping (50/50
 *  structure + flotation, terminal ship = 0) taken at a 10_000 scale. */
export function shipStrengthBp(ship: ShipViability): number {
  return hpOfState(ship.damageState, 10_000) as number;
}

/** Side fleet-strength fraction in bp: floor(sum(ship strength) / ship count),
 *  every ship weighted equally. An empty side fails closed. */
export function sideStrengthBp(ships: readonly ShipViability[], sideId: BattleSide): number {
  const sideShips = ships.filter((s) => s.sideId === sideId);
  if (sideShips.length === 0) {
    throw new BluewaveError(BATTLE_VIABILITY_EVALUATION_FAILED, {
      code: BATTLE_VIABILITY_EVALUATION_FAILED,
      sideId,
      reason: "side has no ships to evaluate — the projection must not produce an empty side",
    });
  }
  return Math.floor(sideShips.reduce((a, s) => a + shipStrengthBp(s), 0) / sideShips.length);
}

/** ADR-0073 withdrawal predicate: a (not eliminated) side whose strength
 *  fraction is STRICTLY below the versioned threshold breaks off. */
export function sideWithdraws(
  ships: readonly ShipViability[],
  sideId: BattleSide,
  thresholdBp: number = WITHDRAWAL_STRENGTH_THRESHOLD_BP,
): boolean {
  return sideStrengthBp(ships, sideId) < thresholdBp;
}

/**
 * ADR-0098: a structured reason for a fleet-strength withdrawal. The engine's
 * only withdrawal predicate is the ADR-0073 fleet-strength threshold, so the
 * reason classifies WHY that side's strength fell below it: dominant flotation
 * loss (progressive flooding / breaches), an active fire, dominant structural
 * (gunfire) loss, or a mutual disengagement. Deterministic, integer-only,
 * derived from the already-resolved per-ship states; never a new draw.
 */
export type WithdrawalReason =
  | "FLEET_STRENGTH_FLOODING"
  | "FLEET_STRENGTH_FIRE"
  | "FLEET_STRENGTH_GUNFIRE"
  | "FLEET_STRENGTH_STRUCTURAL"
  | "MUTUAL_DISENGAGEMENT";

export function classifyWithdrawalReason(
  ships: readonly ShipViability[],
  sideId: BattleSide,
): WithdrawalReason {
  const sideShips = ships.filter((s) => s.sideId === sideId);
  let flotationLoss = 0;
  let structuralLoss = 0;
  let anyFire = false;
  for (const s of sideShips) {
    const st = s.damageState;
    flotationLoss += Math.max(0, FLOAT_UNIT - st.flotationReserve);
    structuralLoss += Math.max(0, STRUCTURE_UNIT - st.structuralIntegrity);
    if (st.fireRecords.length > 0) anyFire = true;
  }
  if (flotationLoss > structuralLoss) return "FLEET_STRENGTH_FLOODING";
  if (anyFire) return "FLEET_STRENGTH_FIRE";
  if (structuralLoss > 0) return "FLEET_STRENGTH_GUNFIRE";
  return "FLEET_STRENGTH_STRUCTURAL";
}

export interface AutoResolutionEndDecision {
  ended: boolean;
  /** Exact §32 reason id when ended. */
  reason?: string;
  /** The eliminated side ("ATTACKER" | "DEFENDER"); null on the tie rule. */
  eliminatedSide?: BattleSide | null;
  /** The side that broke off (`withdrawal_complete`); absent otherwise. */
  withdrawnSide?: BattleSide;
  /** ADR-0098 structured withdrawal reason; present only for withdrawal ends. */
  withdrawalReason?: WithdrawalReason;
}

/**
 * Decide battle end after one fully-resolved minute (terminating-minute effects
 * INCLUDED — the caller has already applied the minute's gunnery+damage).
 */
export function decideBattleEnd(
  ships: readonly ShipViability[],
  elapsedMinutes: number,
  maxMinutes: number,
): AutoResolutionEndDecision {
  const attackerEliminated = sideEliminated(ships, "ATTACKER");
  const defenderEliminated = sideEliminated(ships, "DEFENDER");

  // Deterministic tie: both non-viable in the same minute (ADR-0026).
  if (attackerEliminated && defenderEliminated) {
    return { ended: true, reason: "no_viable_combatants", eliminatedSide: null };
  }
  const eliminated = attackerEliminated
    ? ("ATTACKER" as BattleSide)
    : defenderEliminated
      ? ("DEFENDER" as BattleSide)
      : null;

  // ADR-0073: withdrawal / mutual disengagement (only when nobody is eliminated).
  const attackerWithdraws = !eliminated && sideWithdraws(ships, "ATTACKER");
  const defenderWithdraws = !eliminated && sideWithdraws(ships, "DEFENDER");
  const mutual = attackerWithdraws && defenderWithdraws;
  const withdrawn: BattleSide | undefined = mutual
    ? undefined
    : attackerWithdraws
      ? "ATTACKER"
      : defenderWithdraws
        ? "DEFENDER"
        : undefined;

  const evaluation = evaluateBattleEnd({
    scenarioTerminal: false,
    sideEliminated: eliminated ?? undefined,
    objectiveImmediateEnd: false,
    withdrawalCompletedSide: withdrawn,
    mutualDisengagement: mutual,
    elapsedMinutes,
    maxMinutes,
    currentMinuteEffectsResolved: true,
  });

  if (evaluation.ended) {
    const withdrawalReason: WithdrawalReason | undefined =
      evaluation.reason === "mutual_disengagement"
        ? "MUTUAL_DISENGAGEMENT"
        : evaluation.reason === "withdrawal_complete" && withdrawn
          ? classifyWithdrawalReason(ships, withdrawn)
          : undefined;
    return {
      ended: true,
      reason: evaluation.reason,
      eliminatedSide: eliminated,
      ...(evaluation.reason === "withdrawal_complete" && withdrawn
        ? { withdrawnSide: withdrawn }
        : {}),
      ...(withdrawalReason ? { withdrawalReason } : {}),
    };
  }
  return { ended: false };
}
