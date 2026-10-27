import { compareCodePoints } from "@bluewave/deterministic";
import type { TacticalDivision } from "../tactical/division.js";
import { DIVISION_ORDER_VERSION } from "./constants.js";
import type { DivisionOrderSet, DivisionStance } from "./contracts.js";

export interface LegacyDivisionOrder {
  readonly stance: DivisionStance;
  readonly speedPercent: number;
}

export interface LegacyDivisionOrders {
  readonly divisions: Readonly<Record<string, LegacyDivisionOrder>>;
}

export function divisionOrdersFromLegacy(
  legacy: LegacyDivisionOrders,
  divisions: readonly TacticalDivision[],
  issuedAtMinute = 0,
): DivisionOrderSet {
  const byId = new Map(divisions.map((division) => [division.tacticalDivisionId, division]));
  const divisionIds = Object.keys(legacy.divisions).sort(compareCodePoints);
  return {
    version: DIVISION_ORDER_VERSION,
    divisions: divisionIds.map((divisionId) => {
      const order = legacy.divisions[divisionId]!;
      const division = byId.get(divisionId);
      return {
        divisionId,
        navigation: { kind: "STANCE", stance: order.stance },
        speed: { kind: "PERCENT", percent: order.speedPercent },
        formation: division?.formation ?? null,
        role: division?.role ?? null,
        leadDivisionId: null,
        control: "PLAYER",
        turnTogether: false,
        issuedAtMinute,
      };
    }),
  };
}
