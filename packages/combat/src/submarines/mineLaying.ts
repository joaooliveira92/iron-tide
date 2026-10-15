//packages/combat/src/submarines/mineLaying.ts
// DESIGN-34 §20 submarine mine laying (AC-15, INC-7).
//
// Only MINELAYING submarines or explicitly capable types may execute MINE_LAYING.
// The mission requires mine inventory, technology, legal route, target area,
// readiness, reliability at least 40, and fuel.
//
// This slice ships the eligibility predicate + inventory consumption surface.
// The actual AreaMinePressureRecord creation is deferred to the C-2 continuation
// (mine-strike resolution + phase/snapshot wiring) which owns the C-2 model.
// No mines/ module imports (concurrency boundary: mines/ is read-only as a
// concurrent session's working set per the C-2/C-3 spec note).
//
// Pure/deterministic: no I/O/clock/random.
import { SafeInt } from "@bluewave/contracts";
import { type SubmarineType } from "./constants.js";
import {
  SUBMARINE_MINE_INVENTORY_INSUFFICIENT,
  SUBMARINE_MISSION_INELIGIBLE,
  type SubmarineReasonCode,
} from "./reasonCodes.js";

export const SUBMARINE_MINE_LAYING_RELIABILITY_FLOOR = 40 as const;
export const SUBMARINE_MINE_LAYING_READINESS_FLOOR = 50 as const;
export const SUBMARINE_MINE_LAYING_FUEL_FLOOR_BP = 3_000 as const;

export function isMinelayingCapable(submarineTypeId: SubmarineType): boolean {
  return submarineTypeId === "MINELAYING" || submarineTypeId === "MISSILE";
}

export interface MineLayingRequest {
  targetAreaId: string;
  legalRouteAvailable: boolean;
  mineInventory: SafeInt;
  requiredInventory: SafeInt;
  targetBelligerents: readonly string[];
  availableTechnologyIds: ReadonlySet<string>;
}

export type MineLayingVerdict =
  | {
      accepted: true;
      inventoryAfter: SafeInt;
      reasonCode: null;
    }
  | {
      accepted: false;
      reasonCode: SubmarineReasonCode;
      guard: string;
      message: string;
    };

export function evaluateMineLayingEligibility(
  submarineTypeId: SubmarineType,
  readiness: SafeInt,
  reliability: SafeInt,
  fuelBp: SafeInt,
  atWar: boolean,
  request: MineLayingRequest,
): MineLayingVerdict {
  if (!request) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "request", "mine laying request missing");
  }

  if (!isMinelayingCapable(submarineTypeId)) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "type",
      `type ${submarineTypeId} cannot lay mines (§20)`,
    );
  }

  if (!request.legalRouteAvailable) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "route", "no legal route to target area");
  }

  if (!request.targetAreaId || request.targetAreaId.length === 0) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "targetArea", "target area must be non-empty");
  }

  if (readiness < SUBMARINE_MINE_LAYING_READINESS_FLOOR) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "readiness",
      `readiness ${readiness} below ${SUBMARINE_MINE_LAYING_READINESS_FLOOR} for mine laying`,
    );
  }

  if (reliability < SUBMARINE_MINE_LAYING_RELIABILITY_FLOOR) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "reliability",
      `reliability ${reliability} below ${SUBMARINE_MINE_LAYING_RELIABILITY_FLOOR} for mine laying`,
    );
  }

  if (fuelBp < SUBMARINE_MINE_LAYING_FUEL_FLOOR_BP) {
    return reject(
      SUBMARINE_MISSION_INELIGIBLE,
      "fuel",
      `fuel ${fuelBp} below ${SUBMARINE_MINE_LAYING_FUEL_FLOOR_BP} for mine laying`,
    );
  }

  if (request.mineInventory < request.requiredInventory) {
    return {
      accepted: false,
      reasonCode: SUBMARINE_MINE_INVENTORY_INSUFFICIENT,
      guard: "inventory",
      message: `mine inventory ${request.mineInventory} below required ${request.requiredInventory}`,
    };
  }

  if (!atWar) {
    return reject(SUBMARINE_MISSION_INELIGIBLE, "warState", "nation is not at war");
  }

  for (const prereq of ["minelaying_submarine_technology"]) {
    if (!request.availableTechnologyIds.has(prereq)) {
      return reject(
        SUBMARINE_MISSION_INELIGIBLE,
        "technology",
        `missing technology prerequisite ${prereq}`,
      );
    }
  }

  return {
    accepted: true,
    inventoryAfter: SafeInt(request.mineInventory - request.requiredInventory),
    reasonCode: null,
  };
}

function reject(
  reasonCode: SubmarineReasonCode,
  guard: string,
  message: string,
): MineLayingVerdict {
  return { accepted: false, reasonCode, guard, message };
}
