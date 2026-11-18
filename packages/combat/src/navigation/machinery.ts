import {
  NAVIGATION_BASIS_POINTS,
  NAVIGATION_SPEED_BP_PER_KNOT,
  type FoulingLevel,
  type MachineryState,
  type NavigationFoulingClassRules,
  type NavigationRules,
  type NavigationShipInput,
} from "./model.js";

const FOULING_LOSS_KNOTS: Readonly<Record<FoulingLevel, number>> = {
  CLEAN: 0,
  GRATES_FOULED: 1,
  STOKERS_EXHAUSTED: 2,
};

export function foulingLossBp(level: FoulingLevel): number {
  return FOULING_LOSS_KNOTS[level] * NAVIGATION_SPEED_BP_PER_KNOT;
}

export function foulingCeilingBp(designedSpeedBp: number, level: FoulingLevel): number {
  return Math.max(0, designedSpeedBp - foulingLossBp(level));
}

export function isAtFullSpeed(
  state: MachineryState,
  designedSpeedBp: number,
  currentSpeedBp: number,
): boolean {
  const ceiling = foulingCeilingBp(designedSpeedBp, state.fouling);
  return ceiling > 0 && currentSpeedBp >= ceiling;
}

export function isAtCruiseOrBelow(
  rules: NavigationRules,
  designedSpeedBp: number,
  currentSpeedBp: number,
): boolean {
  return currentSpeedBp * 100 <= designedSpeedBp * rules.fouling.cruiseSpeedPercent;
}

function foulingForMinutes(
  rules: NavigationFoulingClassRules,
  minutes: number,
  floor: FoulingLevel,
): FoulingLevel {
  if (minutes >= rules.stokersExhaustedOnsetMinutes) return "STOKERS_EXHAUSTED";
  if (minutes >= rules.gratesFouledOnsetMinutes && floor !== "STOKERS_EXHAUSTED")
    return "GRATES_FOULED";
  return floor;
}

function recoveredLevel(level: FoulingLevel): FoulingLevel {
  return level === "STOKERS_EXHAUSTED" ? "GRATES_FOULED" : "CLEAN";
}

function minutesAtLevel(level: FoulingLevel, rules: NavigationFoulingClassRules): number {
  if (level === "GRATES_FOULED") return rules.gratesFouledOnsetMinutes;
  if (level === "STOKERS_EXHAUSTED") return rules.stokersExhaustedOnsetMinutes;
  return 0;
}

export function stepFouling(
  rules: NavigationFoulingClassRules,
  state: MachineryState,
  input: { readonly atFullSpeed: boolean; readonly atCruiseOrBelow: boolean },
): Pick<MachineryState, "fullSpeedMinutes" | "fouling" | "recoveryMinutes"> {
  if (input.atFullSpeed) {
    const fullSpeedMinutes = state.fullSpeedMinutes + 1;
    return {
      fullSpeedMinutes,
      fouling: foulingForMinutes(rules, fullSpeedMinutes, state.fouling),
      recoveryMinutes: 0,
    };
  }
  if (input.atCruiseOrBelow && (state.fouling !== "CLEAN" || state.fullSpeedMinutes > 0)) {
    const recoveryMinutes = state.recoveryMinutes + 1;
    if (recoveryMinutes < rules.recoveryMinutes)
      return { fullSpeedMinutes: state.fullSpeedMinutes, fouling: state.fouling, recoveryMinutes };
    const fouling = recoveredLevel(state.fouling);
    return { fullSpeedMinutes: minutesAtLevel(fouling, rules), fouling, recoveryMinutes: 0 };
  }
  return {
    fullSpeedMinutes: state.fullSpeedMinutes,
    fouling: state.fouling,
    recoveryMinutes: state.recoveryMinutes,
  };
}

export function breakdownChancePpm(rules: NavigationRules, ship: NavigationShipInput): number {
  const scaled = Math.trunc(
    (rules.breakdown.priorityChancePpm * ship.enginePriorityBp) / NAVIGATION_BASIS_POINTS,
  );
  return Math.max(
    0,
    Math.min(rules.breakdown.maxChancePpm, rules.breakdown.baseChancePpm + scaled),
  );
}

export function breakdownCeilingBp(rules: NavigationRules, designedSpeedBp: number): number {
  return Math.trunc((designedSpeedBp * rules.breakdown.repairSpeedCapPercent) / 100);
}
