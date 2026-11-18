import type { RandomLedger } from "@bluewave/random";

export const navigationPolicyId = "navigation_v1" as const;
export const NAVIGATION_RULESET_VERSION = "navigation_ruleset_v1" as const;
export const NAVIGATION_BREAKDOWN_STREAM = "navigation.breakdown" as const;
export const NAVIGATION_BREAKDOWN_PHASE = "resolve_propulsion_formation" as const;
export const NAVIGATION_BASIS_POINTS = 10_000 as const;
export const NAVIGATION_PPM = 1_000_000 as const;
export const NAVIGATION_SPEED_BP_PER_KNOT = 1_000 as const;

export const NAVIGATION_MACHINERY_CLASSES = ["OIL", "COAL", "VTE"] as const;
export type NavigationMachineryClass = (typeof NAVIGATION_MACHINERY_CLASSES)[number];

export const FOULING_LEVELS = ["CLEAN", "GRATES_FOULED", "STOKERS_EXHAUSTED"] as const;
export type FoulingLevel = (typeof FOULING_LEVELS)[number];

export interface NavigationFoulingClassRules {
  readonly gratesFouledOnsetMinutes: number;
  readonly stokersExhaustedOnsetMinutes: number;
  readonly recoveryMinutes: number;
}

export interface NavigationRules {
  readonly sectionVersion: 1;
  readonly fouling: {
    readonly cruiseSpeedPercent: number;
    readonly classes: Readonly<Record<NavigationMachineryClass, NavigationFoulingClassRules>>;
  };
  readonly breakdown: {
    readonly baseChancePpm: number;
    readonly priorityChancePpm: number;
    readonly maxChancePpm: number;
    readonly repairMinutes: number;
    readonly repairSpeedCapPercent: number;
  };
  readonly vibration: {
    readonly thresholdKnots: number;
    readonly gunneryMultiplierBp: number;
  };
}

export interface MachineryState {
  readonly fullSpeedMinutes: number;
  readonly fouling: FoulingLevel;
  readonly recoveryMinutes: number;
  readonly breakdownMinutesLeft: number;
}

export const INITIAL_MACHINERY_STATE: MachineryState = {
  fullSpeedMinutes: 0,
  fouling: "CLEAN",
  recoveryMinutes: 0,
  breakdownMinutesLeft: 0,
};

export interface NavigationShipInput {
  readonly shipId: string;
  readonly machineryClass: NavigationMachineryClass;
  readonly enginePriorityBp: number;
  readonly damageSpeedCapBp?: number;
}

export interface NavigationContext {
  readonly rules: NavigationRules;
  readonly ships: readonly NavigationShipInput[];
  readonly machinery?: Readonly<Record<string, MachineryState>>;
  readonly randomLedger?: RandomLedger;
}
