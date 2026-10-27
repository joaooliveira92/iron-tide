import { compareCodePoints } from "@bluewave/deterministic";
import type { TacticalDivision } from "../tactical/division.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { MovementState } from "../movement/neighbour.js";
import { KNOTS_TO_UM_S, SPEED_BP_SCALE } from "../movement/neighbour.js";
import type { UnitOrders } from "../simulation/engine.js";
import { foldHeading, headingToward } from "../battleResolution/engagement.js";
import { TWO_KNOTS_SPEED_BP } from "./constants.js";
import type {
  DivisionOrder,
  DivisionOrderSet,
  DivisionSpeed,
  DivisionSpeedPreset,
} from "./contracts.js";
import {
  DIVISION_ORDER_DUPLICATE_DIVISION,
  DIVISION_ORDER_LEAD_SELF,
  DIVISION_ORDER_LEAD_UNKNOWN,
  DIVISION_ORDER_SPEED_PRESET_UNAVAILABLE,
  DIVISION_ORDER_UNKNOWN_DIVISION,
  DIVISION_ORDER_WAYPOINT_POSITION_UNAVAILABLE,
  type DivisionOrderIssueCode,
} from "./reasonCodes.js";

export interface DivisionOrderIssue {
  readonly code: DivisionOrderIssueCode;
  readonly divisionId: string;
  readonly unitId?: string;
}

export interface DivisionBaseOrder {
  readonly orderedHeading: number;
  readonly orderedSpeedBp: number;
}

export interface CompileDivisionOrdersInput {
  readonly orders: DivisionOrderSet;
  readonly units: readonly TacticalShipUnit[];
  readonly divisions: readonly TacticalDivision[];
  readonly baseOrders: Readonly<Record<string, DivisionBaseOrder>>;
  readonly movement: Readonly<Record<string, MovementState>>;
  readonly pursuit?: Readonly<Record<string, DivisionBaseOrder>>;
  readonly headingAway?: (unit: TacticalShipUnit) => number | null;
  readonly cruiseSpeedBp?: number;
}

export interface CompileDivisionOrdersResult {
  readonly unitOrders: Readonly<Record<string, UnitOrders>>;
  readonly issues: readonly DivisionOrderIssue[];
}

function designedSpeedBp(unit: TacticalShipUnit): number {
  return Math.floor((unit.designedSpeedUms * SPEED_BP_SCALE) / KNOTS_TO_UM_S);
}

function presetSpeedBp(
  preset: DivisionSpeedPreset,
  unit: TacticalShipUnit,
  divisionUnits: readonly TacticalShipUnit[],
  cruiseSpeedBp: number | undefined,
): number | null {
  const designed = designedSpeedBp(unit);
  switch (preset) {
    case "CRUISE":
      return cruiseSpeedBp ?? null;
    case "TWENTY":
      return 20 * SPEED_BP_SCALE;
    case "TWENTY_FIVE":
      return 25 * SPEED_BP_SCALE;
    case "MAX_MINUS_2":
      return Math.max(0, designed - TWO_KNOTS_SPEED_BP);
    case "SQUADRON_MAX":
      return divisionUnits.length === 0
        ? designed
        : divisionUnits.reduce((min, other) => Math.min(min, designedSpeedBp(other)), designed);
  }
}

function resolvedSpeedBp(
  speed: DivisionSpeed,
  base: DivisionBaseOrder,
  unit: TacticalShipUnit,
  divisionUnits: readonly TacticalShipUnit[],
  cruiseSpeedBp: number | undefined,
): number | null {
  switch (speed.kind) {
    case "PERCENT":
      return Math.floor((base.orderedSpeedBp * speed.percent) / 100);
    case "KNOTS":
      return speed.knots * SPEED_BP_SCALE;
    case "PRESET":
      return presetSpeedBp(speed.preset, unit, divisionUnits, cruiseSpeedBp);
  }
}

function orderDivisions(divisions: readonly TacticalDivision[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const division of divisions) {
    for (const unitId of division.orderedTacticalUnitIds) {
      map.set(unitId, division.tacticalDivisionId);
    }
  }
  return map;
}

export function compileDivisionOrders(
  input: CompileDivisionOrdersInput,
): CompileDivisionOrdersResult {
  const issues: DivisionOrderIssue[] = [];
  const known = new Set(input.divisions.map((division) => division.tacticalDivisionId));
  const orders = new Map<string, DivisionOrder>();
  for (const order of input.orders.divisions) {
    if (orders.has(order.divisionId)) {
      issues.push({ code: DIVISION_ORDER_DUPLICATE_DIVISION, divisionId: order.divisionId });
      continue;
    }
    orders.set(order.divisionId, order);
    if (!known.has(order.divisionId)) {
      issues.push({ code: DIVISION_ORDER_UNKNOWN_DIVISION, divisionId: order.divisionId });
    }
  }
  for (const order of orders.values()) {
    const lead = order.leadDivisionId;
    if (lead === null) continue;
    if (lead === order.divisionId) {
      issues.push({ code: DIVISION_ORDER_LEAD_SELF, divisionId: order.divisionId });
    } else if (!known.has(lead)) {
      issues.push({ code: DIVISION_ORDER_LEAD_UNKNOWN, divisionId: order.divisionId });
    }
  }

  const unitDivision = orderDivisions(input.divisions);
  const divisionUnits = new Map<string, TacticalShipUnit[]>();
  for (const unit of input.units) {
    const divisionId = unitDivision.get(unit.assetId);
    if (divisionId === undefined) continue;
    const list = divisionUnits.get(divisionId) ?? [];
    list.push(unit);
    divisionUnits.set(divisionId, list);
  }

  const unitOrders: Record<string, UnitOrders> = {};
  for (const unit of input.units) {
    const base = input.baseOrders[unit.assetId];
    if (base === undefined) continue;
    const divisionId = unitDivision.get(unit.assetId);
    const order = divisionId === undefined ? undefined : orders.get(divisionId);
    if (order === undefined) {
      unitOrders[unit.assetId] = {
        orderedHeading: input.pursuit?.[unit.assetId]?.orderedHeading ?? base.orderedHeading,
        orderedSpeedBp: base.orderedSpeedBp,
      };
      continue;
    }
    const units = divisionUnits.get(order.divisionId) ?? [unit];
    const speedForOrder = (): number => {
      const resolved = resolvedSpeedBp(order.speed, base, unit, units, input.cruiseSpeedBp);
      if (resolved === null) {
        issues.push({
          code: DIVISION_ORDER_SPEED_PRESET_UNAVAILABLE,
          divisionId: order.divisionId,
          unitId: unit.assetId,
        });
        return base.orderedSpeedBp;
      }
      return resolved;
    };
    switch (order.navigation.kind) {
      case "STANCE": {
        if (order.navigation.stance === "HOLD") {
          unitOrders[unit.assetId] = { orderedHeading: base.orderedHeading, orderedSpeedBp: 0 };
        } else if (order.navigation.stance === "WITHDRAW") {
          unitOrders[unit.assetId] = {
            orderedHeading: input.headingAway?.(unit) ?? base.orderedHeading,
            orderedSpeedBp: speedForOrder(),
          };
        } else {
          unitOrders[unit.assetId] = {
            orderedHeading: input.pursuit?.[unit.assetId]?.orderedHeading ?? base.orderedHeading,
            orderedSpeedBp: speedForOrder(),
          };
        }
        break;
      }
      case "COURSE": {
        unitOrders[unit.assetId] = {
          orderedHeading: foldHeading(order.navigation.headingDeg),
          orderedSpeedBp: speedForOrder(),
        };
        break;
      }
      case "WAYPOINT": {
        const movement = input.movement[unit.assetId];
        if (movement === undefined) {
          issues.push({
            code: DIVISION_ORDER_WAYPOINT_POSITION_UNAVAILABLE,
            divisionId: order.divisionId,
            unitId: unit.assetId,
          });
          unitOrders[unit.assetId] = {
            orderedHeading: base.orderedHeading,
            orderedSpeedBp: speedForOrder(),
          };
        } else {
          unitOrders[unit.assetId] = {
            orderedHeading: headingToward(
              order.navigation.xMetres - movement.position[0],
              order.navigation.yMetres - movement.position[1],
            ),
            orderedSpeedBp: speedForOrder(),
          };
        }
        break;
      }
    }
  }

  const sorted = [...issues].sort((a, b) => {
    const byCode = compareCodePoints(a.code, b.code);
    if (byCode !== 0) return byCode;
    const byDivision = compareCodePoints(a.divisionId, b.divisionId);
    if (byDivision !== 0) return byDivision;
    return compareCodePoints(a.unitId ?? "", b.unitId ?? "");
  });

  return { unitOrders, issues: sorted };
}
