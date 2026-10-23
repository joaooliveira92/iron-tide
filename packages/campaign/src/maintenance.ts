import { SafeInt } from "@bluewave/contracts";
import type { ShipReadinessState } from "./readiness.js";

export const MAINTENANCE_FORMULA_ID = "maintenance_v2";
export const MAINTENANCE_FORMULA_VERSION = "2.0.0";

export const MAINTENANCE_ACTIVE_MULTIPLIER_BP = SafeInt(10_000);
export const MAINTENANCE_WORKING_UP_MULTIPLIER_BP = SafeInt(10_000);
export const MAINTENANCE_RESERVE_MULTIPLIER_BP = SafeInt(7_500);
export const MAINTENANCE_MOTHBALLED_MULTIPLIER_BP = SafeInt(5_000);
export const MAINTENANCE_REPAIR_MULTIPLIER_BP = SafeInt(20_000);
export const MAINTENANCE_WARTIME_MULTIPLIER_BP = SafeInt(12_500);

const SHIP_READINESS_STATES_BY_COST_ORDER = [
  "ACTIVE",
  "WORKING_UP",
  "RESERVE",
  "MOTHBALLED",
  "REPAIR",
] as const satisfies readonly ShipReadinessState[];

const MULTIPLIER_BP: Record<ShipReadinessState, SafeInt> = {
  ACTIVE: MAINTENANCE_ACTIVE_MULTIPLIER_BP,
  WORKING_UP: MAINTENANCE_WORKING_UP_MULTIPLIER_BP,
  RESERVE: MAINTENANCE_RESERVE_MULTIPLIER_BP,
  MOTHBALLED: MAINTENANCE_MOTHBALLED_MULTIPLIER_BP,
  REPAIR: MAINTENANCE_REPAIR_MULTIPLIER_BP,
};

export function maintenanceMultiplierBp(readiness: ShipReadinessState): SafeInt {
  return MULTIPLIER_BP[readiness];
}

export function shipMaintenanceCost(hitPoints: SafeInt, readiness: ShipReadinessState): SafeInt {
  const base = SafeInt.div(SafeInt.mul(hitPoints, SafeInt(10)), SafeInt(100), "floor");
  return SafeInt.div(
    SafeInt.mul(base, maintenanceMultiplierBp(readiness)),
    SafeInt(10_000),
    "floor",
  );
}

export interface WarPartyRecord {
  readonly status: string;
  readonly attackerSideMembers: readonly string[];
  readonly defenderSideMembers: readonly string[];
}

export function nationIsAtWar(wars: readonly WarPartyRecord[], nationId: string): boolean {
  return wars.some(
    (war) =>
      (war.status === "ACTIVE" || war.status === "DECLARED_NOT_ACTIVE") &&
      (war.attackerSideMembers.includes(nationId) || war.defenderSideMembers.includes(nationId)),
  );
}

export function shipMonthlyMaintenanceCost(
  hitPoints: SafeInt,
  readiness: ShipReadinessState,
  atWar: boolean,
  overBaseAdderBp?: SafeInt,
): SafeInt {
  const cost = shipMaintenanceCost(hitPoints, readiness);
  const monthly =
    !atWar || readiness !== "ACTIVE"
      ? cost
      : SafeInt.div(SafeInt.mul(cost, MAINTENANCE_WARTIME_MULTIPLIER_BP), SafeInt(10_000), "floor");
  if (overBaseAdderBp === undefined) return monthly;
  return SafeInt.div(
    SafeInt.mul(monthly, SafeInt.add(SafeInt(10_000), overBaseAdderBp)),
    SafeInt(10_000),
    "floor",
  );
}

export interface MaintainedShip {
  readonly hitPoints: SafeInt;
  readonly readiness: ShipReadinessState;
  readonly overBase?: { readonly maintenanceAdderBp: SafeInt };
}

export interface MaintainedFleet {
  readonly ships: readonly MaintainedShip[];
}

export interface NamedMaintainedShip extends MaintainedShip {
  readonly id: string;
  readonly name: string;
}

export interface ReadinessMaintenanceGroup {
  readonly readiness: ShipReadinessState;
  readonly ships: number;
  readonly cost: number;
  readonly multiplierBp: number;
}

export interface ShipMaintenanceLine {
  readonly id: string;
  readonly name: string;
  readonly readiness: ShipReadinessState;
  readonly cost: number;
  readonly overBase: boolean;
}

export interface FleetMaintenanceBreakdown {
  readonly total: number;
  readonly atWar: boolean;
  readonly warSurcharge: number;
  readonly groups: readonly ReadinessMaintenanceGroup[];
  readonly ships: readonly ShipMaintenanceLine[];
}

export function nationMonthlyMaintenance(
  fleets: readonly MaintainedFleet[],
  atWar: boolean,
): SafeInt {
  let total = SafeInt.ZERO;
  for (const fleet of fleets)
    for (const ship of fleet.ships)
      total = SafeInt.add(
        total,
        shipMonthlyMaintenanceCost(
          ship.hitPoints,
          ship.readiness,
          atWar,
          ship.overBase?.maintenanceAdderBp,
        ),
      );
  return total;
}

export function fleetMaintenanceBreakdown(
  fleets: readonly { readonly ships: readonly NamedMaintainedShip[] }[],
  atWar: boolean,
): FleetMaintenanceBreakdown {
  const ships: ShipMaintenanceLine[] = [];
  let peaceTotal = 0;
  for (const fleet of fleets)
    for (const ship of fleet.ships) {
      const adder = ship.overBase?.maintenanceAdderBp;
      const cost = Number(shipMonthlyMaintenanceCost(ship.hitPoints, ship.readiness, atWar, adder));
      peaceTotal += Number(
        shipMonthlyMaintenanceCost(ship.hitPoints, ship.readiness, false, adder),
      );
      ships.push({
        id: ship.id,
        name: ship.name,
        readiness: ship.readiness,
        cost,
        overBase: ship.overBase !== undefined,
      });
    }
  const total = ships.reduce((sum, ship) => sum + ship.cost, 0);
  const groups = SHIP_READINESS_STATES_BY_COST_ORDER.map((readiness) => {
    const members = ships.filter((ship) => ship.readiness === readiness);
    return {
      readiness,
      ships: members.length,
      cost: members.reduce((sum, ship) => sum + ship.cost, 0),
      multiplierBp: Number(maintenanceMultiplierBp(readiness)),
    };
  });
  return {
    total,
    atWar,
    warSurcharge: total - peaceTotal,
    groups,
    ships: [...ships].sort((a, b) => b.cost - a.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}
