import { SafeInt } from "@bluewave/contracts";
import type { MovementState } from "@bluewave/combat/movement";
import type { FormationContext, FormationKeepingRuleset } from "@bluewave/combat/formation";
import type { NavigationContext, NavigationRules } from "@bluewave/combat/navigation";
import type { UnitOrders } from "@bluewave/combat/simulation";
import type { TacticalBattleState, TacticalDivision } from "@bluewave/combat/tactical";
import { buildTestState } from "../simulation/advance.test.js";

export const OBSERVATION = "1900-01-01T00:00:00.000Z";
export const KNOT_BP = 1_000;
export const SHIP_IDS = ["f1", "f2", "f3"] as const;

export const FORMATION_RULESET: FormationKeepingRuleset = {
  columnIntervalUm: 400_000_000,
  abreastIntervalUm: 400_000_000,
  searchLineIntervalUm: 1_200_000_000,
  divisionGapUm: 500_000_000,
  stationToleranceUm: 50_000_000,
  trackCapacity: 1_800,
  catchUpMarginBp: 2_000,
  catchUpFullErrorUm: 400_000_000,
};

export const BASE_RULES: NavigationRules = {
  sectionVersion: 1,
  fouling: {
    cruiseSpeedPercent: 70,
    classes: {
      OIL: { gratesFouledOnsetMinutes: 9, stokersExhaustedOnsetMinutes: 18, recoveryMinutes: 20 },
      COAL: { gratesFouledOnsetMinutes: 3, stokersExhaustedOnsetMinutes: 6, recoveryMinutes: 8 },
      VTE: { gratesFouledOnsetMinutes: 2, stokersExhaustedOnsetMinutes: 4, recoveryMinutes: 6 },
    },
  },
  breakdown: {
    baseChancePpm: 0,
    priorityChancePpm: 0,
    maxChancePpm: 1_000_000,
    repairMinutes: 4,
    repairSpeedCapPercent: 50,
  },
  vibration: { thresholdKnots: 25, gunneryMultiplierBp: 9_000 },
};

export const SEPARATION_BLOCK = {
  formationBaseBp: { LINE_ABREAST: 10_000, SEARCH_LINE: 10_000, SCREEN: 10_000 },
  nightFactorBp: 15_000,
  poorVisibilityFactorBp: 20_000,
  poorVisibilityThresholdUm: 4_000_000_000,
  cohesionReferenceBp: 10_000,
  heavyShipTypes: ["BB", "BC", "B", "CA"],
  drift: {
    thresholdMinutes: 3,
    toleranceMultiplierBp: 30_000,
    steeringErrorDeg: 5,
  },
} as const;

export function movement(
  position: [number, number],
  heading: number,
  speedBp: number,
): MovementState {
  return {
    position,
    heading,
    orderedSpeed: speedBp,
    currentSpeed: speedBp,
    acceleration: 0,
    turningRate: 1_000,
    collisionRadius: 5_000_000,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
  };
}

export function division(overrides: Partial<TacticalDivision> = {}): TacticalDivision {
  return {
    tacticalDivisionId: "div-1",
    battleId: "b1",
    sideId: "ATTACKER",
    role: "CORE",
    formation: "LINE_ABREAST",
    orderedTacticalUnitIds: [...SHIP_IDS],
    tacticalFlagshipId: "f1",
    tacticalCommanderId: "commander-1",
    sourcePermanentDivisionIds: [],
    projectionAdjustmentRecords: [],
    campaignAssetProvenanceIds: [],
    temporaryAssetProvenanceIds: [],
    initialExperience: SafeInt(0),
    initialCohesion: SafeInt(100),
    rulesetVersion: "test",
    recordHash: "hash",
    ...overrides,
  };
}

export interface ScenarioOptions {
  readonly divisionOverrides?: Partial<TacticalDivision>;
  readonly shipTypes?: Readonly<Record<string, string>>;
  readonly speedBp?: number;
  readonly positions?: Readonly<Record<string, [number, number]>>;
}

export function scenarioState(options: ScenarioOptions = {}): TacticalBattleState {
  const base = buildTestState();
  const template = base.units[0]!;
  const speedBp = options.speedBp ?? 15 * KNOT_BP;
  const units = SHIP_IDS.map((id) => ({
    ...template,
    assetId: id,
    campaignShipId: id,
    name: id,
    sideId: "ATTACKER" as const,
    shipType: (options.shipTypes?.[id] ?? "DD") as typeof template.shipType,
  }));
  const movementStates: Record<string, MovementState> = {};
  SHIP_IDS.forEach((id, index) => {
    movementStates[id] = movement(options.positions?.[id] ?? [0, index * 400_000_000], 0, speedBp);
  });
  return {
    ...base,
    sides: [{ sideId: "ATTACKER", participantIds: [...SHIP_IDS] }],
    forces: { ATTACKER: [...SHIP_IDS] },
    divisions: [division(options.divisionOverrides)],
    units,
    movementStates,
  };
}

export function scenarioOrders(speedBp = 15 * KNOT_BP): Record<string, UnitOrders> {
  const orders: Record<string, UnitOrders> = {};
  for (const id of SHIP_IDS) {
    orders[id] = { orderedHeading: 0, orderedSpeedBp: speedBp, attainableMaxBp: 30 * KNOT_BP };
  }
  return orders;
}

export const FORMATION: FormationContext = { ruleset: FORMATION_RULESET };

export function navigationContext(
  rules: NavigationRules,
  overrides: Partial<NavigationContext> = {},
): NavigationContext {
  return {
    rules,
    ships: SHIP_IDS.map((shipId) => ({
      shipId,
      machineryClass: "OIL" as const,
      enginePriorityBp: 0,
    })),
    ...overrides,
  };
}
