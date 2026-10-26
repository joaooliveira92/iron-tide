import type { Ship } from "./state.js";
import type { StationAssignment } from "./stationAssignment.js";

export const SHIP_USES = ["SAIL", "ENTER_BATTLE", "HOLD_STATION", "TAKE_MISSION"] as const;
export type ShipUse = (typeof SHIP_USES)[number];

export const GATE_REASON_TAGS = [
  "UnderConstruction",
  "Unavailable",
  "WorkingUp",
  "InRepair",
  "InReserve",
  "Mothballed",
  "InBattle",
  "Assigned",
  "AssignmentForbidsUse",
] as const;
export type GateReasonTag = (typeof GATE_REASON_TAGS)[number];

export interface GateReason {
  readonly _tag: GateReasonTag;
}

export type ShipGateSubject = Pick<
  Ship,
  "isUnderConstruction" | "availability" | "readiness" | "inBattleId" | "stationAssignment"
>;

type Gate = (ship: ShipGateSubject, use: ShipUse) => GateReasonTag | null;

export const ASSIGNMENT_ALLOWED_USES: Readonly<Record<StationAssignment, readonly ShipUse[]>> = {
  FOREIGN_STATION: ["ENTER_BATTLE"],
  EXERCISE: [],
};

const underConstruction: Gate = (ship) => (ship.isUnderConstruction ? "UnderConstruction" : null);

const unavailable: Gate = (ship) => (ship.availability === "UNAVAILABLE" ? "Unavailable" : null);

const readinessGate: Gate = (ship) => {
  switch (ship.readiness) {
    case "ACTIVE":
      return null;
    case "WORKING_UP":
      return "WorkingUp";
    case "REPAIR":
      return "InRepair";
    case "RESERVE":
      return "InReserve";
    case "MOTHBALLED":
      return "Mothballed";
  }
};

const notInBattle: Gate = (ship) => (ship.inBattleId === undefined ? null : "InBattle");

const unassigned: Gate = (ship) => (ship.stationAssignment === undefined ? null : "Assigned");

const assignmentAllowsUse: Gate = (ship, use) => {
  if (ship.stationAssignment === undefined) return null;
  return ASSIGNMENT_ALLOWED_USES[ship.stationAssignment].includes(use)
    ? null
    : "AssignmentForbidsUse";
};

const GATES_BY_USE: Readonly<Record<ShipUse, readonly Gate[]>> = {
  SAIL: [underConstruction, unavailable, assignmentAllowsUse],
  ENTER_BATTLE: [underConstruction, unavailable, readinessGate, notInBattle, assignmentAllowsUse],
  HOLD_STATION: [underConstruction, unavailable, readinessGate, unassigned],
  TAKE_MISSION: [underConstruction, unavailable, readinessGate, notInBattle, unassigned],
};

export function evaluateShipGates(ship: ShipGateSubject, use: ShipUse): readonly GateReason[] {
  const reasons: GateReason[] = [];
  for (const gate of GATES_BY_USE[use]) {
    const tag = gate(ship, use);
    if (tag !== null) reasons.push({ _tag: tag });
  }
  return reasons;
}

export function firstGateReason(ship: ShipGateSubject, use: ShipUse): GateReason | null {
  return evaluateShipGates(ship, use)[0] ?? null;
}

export function isShipEligible(ship: ShipGateSubject, use: ShipUse): boolean {
  return evaluateShipGates(ship, use).length === 0;
}
