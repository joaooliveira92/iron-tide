import { BluewaveError } from "@bluewave/contracts";
import { evaluateBattleEnd } from "../battleEnd.js";
import { type ShipDamageState } from "../damage/state.js";
import { FLOAT_UNIT, STRUCTURE_UNIT, WITHDRAWAL_STRENGTH_THRESHOLD_BP } from "./constants.js";
import { hpOfState } from "./damage.js";
import { BATTLE_VIABILITY_EVALUATION_FAILED } from "./reasonCodes.js";

export type BattleSide = "ATTACKER" | "DEFENDER";

export interface ShipViability {
  assetId: string;
  sideId: BattleSide;
  damageState: ShipDamageState;
}

export function isShipNonViable(ship: ShipViability): boolean {
  const s = ship.damageState;
  if (s.terminalStatus !== "NORMAL") return true;
  return s.structuralIntegrity <= 0 && s.flotationReserve <= 0;
}

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

export function shipStrengthBp(ship: ShipViability): number {
  return hpOfState(ship.damageState, 10_000) as number;
}

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

export function sideWithdraws(
  ships: readonly ShipViability[],
  sideId: BattleSide,
  thresholdBp: number = WITHDRAWAL_STRENGTH_THRESHOLD_BP,
): boolean {
  return sideStrengthBp(ships, sideId) < thresholdBp;
}

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
  reason?: string;
  eliminatedSide?: BattleSide | null;
  withdrawnSide?: BattleSide;
  withdrawalReason?: WithdrawalReason;
}

export function decideBattleEnd(
  ships: readonly ShipViability[],
  elapsedMinutes: number,
  maxMinutes: number,
): AutoResolutionEndDecision {
  const attackerEliminated = sideEliminated(ships, "ATTACKER");
  const defenderEliminated = sideEliminated(ships, "DEFENDER");

  if (attackerEliminated && defenderEliminated) {
    return { ended: true, reason: "no_viable_combatants", eliminatedSide: null };
  }
  const eliminated = attackerEliminated
    ? ("ATTACKER" as BattleSide)
    : defenderEliminated
      ? ("DEFENDER" as BattleSide)
      : null;

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
