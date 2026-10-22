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

export interface MaintainedFleet {
  readonly ships: readonly {
    readonly hitPoints: SafeInt;
    readonly readiness: ShipReadinessState;
    readonly overBase?: { readonly maintenanceAdderBp: SafeInt };
  }[];
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
