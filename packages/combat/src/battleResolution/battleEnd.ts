import { BluewaveError } from "@bluewave/contracts";
export const DEFAULT_MAX_BATTLE_MINUTES = 360 as const;
export const BATTLE_END_PRECEDENCE = [
  "scenario_terminal",
  "no_viable_combatants",
  "objective_immediate",
  "withdrawal_complete",
  "mutual_disengagement",
  "time_limit",
] as const;

export function evaluateBattleEnd(state: {
  scenarioTerminal: boolean;
  sideEliminated?: string;
  objectiveImmediateEnd: boolean;
  withdrawalCompletedSide?: string;
  mutualDisengagement: boolean;
  elapsedMinutes: number;
  maxMinutes: number;
  currentMinuteEffectsResolved: boolean;
}): { ended: boolean; reason: string } | { ended: false } {
  if (state.scenarioTerminal) return { ended: true, reason: "scenario_terminal" };
  if (state.sideEliminated) return { ended: true, reason: "no_viable_combatants" };
  if (state.objectiveImmediateEnd) return { ended: true, reason: "objective_immediate" };
  if (state.withdrawalCompletedSide) return { ended: true, reason: "withdrawal_complete" };
  if (state.mutualDisengagement) return { ended: true, reason: "mutual_disengagement" };
  if (state.elapsedMinutes >= state.maxMinutes) {
    if (!state.currentMinuteEffectsResolved)
      throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
        code: "TACTICAL_STATE_INVARIANT_FAILED",
        reason: "must resolve current minute before time_limit end",
      });
    return { ended: true, reason: "time_limit" };
  }
  return { ended: false };
}
