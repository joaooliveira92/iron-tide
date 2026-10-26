import { crewCeilingFor } from "./readiness.js";
import type { Ship } from "./state.js";

export const SHIP_CONDITIONS = ["UnderStrength", "Detached", "Damaged", "OutOfAction"] as const;
export type ShipCondition = (typeof SHIP_CONDITIONS)[number];

export type ShipConditionSubject = Pick<
  Ship,
  | "isUnderConstruction"
  | "readiness"
  | "crewQuality"
  | "hitPoints"
  | "maxHitPoints"
  | "availability"
  | "stationAssignment"
>;

type Predicate = (ship: ShipConditionSubject) => boolean;

const PREDICATES: Readonly<Record<ShipCondition, Predicate>> = {
  UnderStrength: (ship) => ship.crewQuality < crewCeilingFor(ship.readiness),
  Detached: (ship) => ship.stationAssignment === "FOREIGN_STATION",
  Damaged: (ship) => ship.hitPoints < ship.maxHitPoints || ship.availability === "DEGRADED",
  OutOfAction: (ship) => ship.availability === "UNAVAILABLE" || ship.readiness === "REPAIR",
};

export function deriveShipConditions(ship: ShipConditionSubject): readonly ShipCondition[] {
  if (ship.isUnderConstruction) return [];
  return SHIP_CONDITIONS.filter((condition) => PREDICATES[condition](ship));
}
