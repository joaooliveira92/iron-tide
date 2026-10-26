import type { GunneryBattery } from "../gunnery/resolve.js";
import type { TimeOfDayState } from "../weather/constants.js";

export interface BattleTrainingEffects {
  readonly gunneryBp: number;
  readonly nightFightingBp: number;
  readonly torpedoTacticsBp: number;
  readonly damageControlBp: number;
}

export const NO_TRAINING_EFFECTS: BattleTrainingEffects = {
  gunneryBp: 0,
  nightFightingBp: 0,
  torpedoTacticsBp: 0,
  damageControlBp: 0,
};

export type TrainingEffectsBySide = Readonly<Record<string, BattleTrainingEffects>>;

const NEUTRAL_BP = 10_000;

const NIGHT_STATES: ReadonlySet<TimeOfDayState> = new Set(["NIGHT", "TWILIGHT_NIGHT"]);

export function isNightTimeOfDay(state: TimeOfDayState): boolean {
  return NIGHT_STATES.has(state);
}

export function scaleByTrainingBp(base: number, bonusBp: number): number {
  return Math.floor((base * (NEUTRAL_BP + bonusBp)) / NEUTRAL_BP);
}

export function effectsOf(
  bySide: TrainingEffectsBySide | undefined,
  sideId: string | undefined,
): BattleTrainingEffects {
  if (bySide === undefined || sideId === undefined) return NO_TRAINING_EFFECTS;
  return bySide[sideId] ?? NO_TRAINING_EFFECTS;
}

export function withNightTraining(
  batteries: readonly GunneryBattery[],
  bySide: TrainingEffectsBySide | undefined,
  timeOfDay: TimeOfDayState,
): GunneryBattery[] {
  if (bySide === undefined || !isNightTimeOfDay(timeOfDay)) return [...batteries];
  return batteries.map((battery) => {
    const bonus = effectsOf(bySide, battery.sideId).nightFightingBp;
    return bonus === 0
      ? battery
      : {
          ...battery,
          accuracyFactors: {
            ...battery.accuracyFactors,
            training: scaleByTrainingBp(battery.accuracyFactors.training, bonus),
          },
        };
  });
}
