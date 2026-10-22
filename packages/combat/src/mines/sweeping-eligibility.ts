import { type MineLayingDamageState } from "./laying.js";
import { SWEEPING_BASE_VALUE_KEYS } from "./sweeping-base-values.js";

export const MINESWEEPING_ELIGIBLE_SHIP_TYPES = [
  ...SWEEPING_BASE_VALUE_KEYS,
  "OTHER_EXPLICITLY_ELIGIBLE",
] as const;
export type MinesweepingShipType = (typeof MINESWEEPING_ELIGIBLE_SHIP_TYPES)[number];

export const MINESWEEPING_READINESS_STATES = [
  "ACTIVE",
  "MOBILIZING",
  "WORKING_UP",
  "IN_RESERVE",
] as const;
export type MinesweepingShipReadiness = (typeof MINESWEEPING_READINESS_STATES)[number];

export const MINESWEEPING_UNAVAILABLE_FLAGS = ["INTERNED", "CAPTURED", "MAJOR_DOCKYARD"] as const;
export type MinesweepingUnavailableFlag = (typeof MINESWEEPING_UNAVAILABLE_FLAGS)[number];

export const MINESWEEPING_MISSIONS = ["MINE_WARFARE", "TRADE_PROTECTION"] as const;
export type MinesweepingMission = (typeof MINESWEEPING_MISSIONS)[number];

export interface MinesweepingShip {
  shipId: string;
  shipType: MinesweepingShipType;
  sweepEquipmentInstalled: boolean;
  sweepEquipmentOperational: boolean;
  sweepEquipmentCompatibleWithMineType: boolean | "unknown";
  mission: MinesweepingMission;
  sweepingAuthorization: boolean;
  readiness: MinesweepingShipReadiness;
  damage: MineLayingDamageState;
  locatedInSweptAreaOrConnectedApproach: boolean;
  fuelSufficient: boolean;
  supplySufficient: boolean;
  crewSufficient: boolean;
  ammunitionOrSweepInventorySufficient: boolean;
  unavailableFlags: readonly MinesweepingUnavailableFlag[];
  validatedSweepingCommandOrPlanActive: boolean;
}

export type MinesweepingEligibilityPredicate =
  | "shipTypeEligible"
  | "equipmentInstalled"
  | "equipmentOperational"
  | "equipmentCompatible"
  | "missionAndSweepingAuthorization"
  | "readinessActive"
  | "damageOperationalOrDegraded"
  | "locatedInSweptAreaOrConnectedApproach"
  | "fuelSupplyCrewAmmunitionSufficient"
  | "notUnavailable"
  | "validatedSweepingCommandOrPlanActive";

export const MINESWEEPING_INELIGIBILITY_REASONS: Readonly<
  Record<MinesweepingEligibilityPredicate, string>
> = {
  shipTypeEligible:
    "ship type is not in the eligible minesweeping ship-type set (§6) — the type must be a §7 shipped key or an explicitly eligible type, never a name/class description",
  equipmentInstalled: "mine-sweeping equipment is not installed (§6)",
  equipmentOperational: "mine-sweeping equipment is not operational (§6)",
  equipmentCompatible:
    "mine-sweeping equipment is not compatible with the mined water (unknown compatibility is ineligible) (§6)",
  missionAndSweepingAuthorization:
    "mission is not MINE_WARFARE, or TRADE_PROTECTION without sweeping authorization (§6)",
  readinessActive: "ship readiness is not ACTIVE (§6)",
  damageOperationalOrDegraded: "damage state is below OPERATIONAL/DEGRADED (§6)",
  locatedInSweptAreaOrConnectedApproach:
    "ship is not located in the swept area or an explicitly connected approach (§6)",
  fuelSupplyCrewAmmunitionSufficient:
    "fuel, supply, crew, or ammunition/sweep-inventory is insufficient (§6)",
  notUnavailable: "ship is unavailable, interned, captured, or in a major dockyard project (§6)",
  validatedSweepingCommandOrPlanActive:
    "no validated sweeping command or operational plan is active (§6)",
};

export interface MinesweepingEligibilityVerdict {
  predicateResults: Record<MinesweepingEligibilityPredicate, boolean>;
  failingPredicate: MinesweepingEligibilityPredicate | null;
}

export type MinesweepingEligibilityResult =
  | { eligible: true; ship: MinesweepingShip; verdict: MinesweepingEligibilityVerdict }
  | { eligible: false; reason: string; verdict: MinesweepingEligibilityVerdict };

function inEligibleShipTypes(t: unknown): t is MinesweepingShipType {
  return (MINESWEEPING_ELIGIBLE_SHIP_TYPES as readonly string[]).includes(t as string);
}

export function minesweepingShipEligible(ship: MinesweepingShip): MinesweepingEligibilityResult {
  const predicateResults = {} as Record<MinesweepingEligibilityPredicate, boolean>;
  let failingPredicate: MinesweepingEligibilityPredicate | null = null;

  const check = (name: MinesweepingEligibilityPredicate, passes: boolean): void => {
    predicateResults[name] = passes;
    if (!passes && failingPredicate === null) failingPredicate = name;
  };

  check("shipTypeEligible", inEligibleShipTypes(ship.shipType));
  check("equipmentInstalled", ship.sweepEquipmentInstalled === true);
  check("equipmentOperational", ship.sweepEquipmentOperational === true);
  check("equipmentCompatible", ship.sweepEquipmentCompatibleWithMineType === true);
  check(
    "missionAndSweepingAuthorization",
    ship.mission === "MINE_WARFARE" ||
      (ship.mission === "TRADE_PROTECTION" && ship.sweepingAuthorization === true),
  );
  check("readinessActive", ship.readiness === "ACTIVE");
  check("damageOperationalOrDegraded", ship.damage === "OPERATIONAL" || ship.damage === "DEGRADED");
  check(
    "locatedInSweptAreaOrConnectedApproach",
    ship.locatedInSweptAreaOrConnectedApproach === true,
  );
  check(
    "fuelSupplyCrewAmmunitionSufficient",
    ship.fuelSufficient === true &&
      ship.supplySufficient === true &&
      ship.crewSufficient === true &&
      ship.ammunitionOrSweepInventorySufficient === true,
  );
  check(
    "notUnavailable",
    Array.isArray(ship.unavailableFlags) && ship.unavailableFlags.length === 0,
  );
  check("validatedSweepingCommandOrPlanActive", ship.validatedSweepingCommandOrPlanActive === true);

  const verdict: MinesweepingEligibilityVerdict = { predicateResults, failingPredicate };
  if (failingPredicate === null) return { eligible: true, ship, verdict };
  return { eligible: false, reason: MINESWEEPING_INELIGIBILITY_REASONS[failingPredicate], verdict };
}

export const INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION = 0 as const;

export const CANONICAL_MINED_WATER_SHIP_TYPES: readonly MinesweepingShipType[] =
  MINESWEEPING_ELIGIBLE_SHIP_TYPES;
