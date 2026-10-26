import { SafeInt } from "@bluewave/contracts";

import {
  divisionAggregateHash,
  type DivisionFormation,
  type DivisionRole,
  type PermanentDivision,
} from "./division.js";
import type { Ship } from "./state.js";

export interface DivisionDoctrineChange {
  readonly divisionRole?: DivisionRole;
  readonly preferredFormation?: DivisionFormation;
}

export interface DivisionReorganisationPenalty {
  readonly cohesion: number;
  readonly experience: number;
}

export interface DivisionDoctrinePenalties {
  readonly roleChange: DivisionReorganisationPenalty;
  readonly formationChange: DivisionReorganisationPenalty;
}

export interface DivisionDoctrineResult {
  readonly division: PermanentDivision;
  readonly changedRole: boolean;
  readonly changedFormation: boolean;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function divisionDoctrineChanges(
  division: PermanentDivision,
  change: DivisionDoctrineChange,
): { readonly role: boolean; readonly formation: boolean } {
  return {
    role: change.divisionRole !== undefined && change.divisionRole !== division.divisionRole,
    formation:
      change.preferredFormation !== undefined &&
      change.preferredFormation !== division.preferredFormation,
  };
}

export function applyDivisionDoctrineChange(
  division: PermanentDivision,
  change: DivisionDoctrineChange,
  month: string,
  penalties?: DivisionDoctrinePenalties,
): DivisionDoctrineResult {
  const changes = divisionDoctrineChanges(division, change);
  if (!changes.role && !changes.formation) {
    return { division, changedRole: false, changedFormation: false };
  }

  let cohesion = division.cohesion as number;
  let experience = division.experience as number;
  if (penalties !== undefined) {
    for (const penalty of [
      ...(changes.role ? [penalties.roleChange] : []),
      ...(changes.formation ? [penalties.formationChange] : []),
    ]) {
      cohesion -= penalty.cohesion;
      experience -= penalty.experience;
    }
  }

  const next: PermanentDivision = {
    ...division,
    divisionRole: changes.role ? (change.divisionRole as DivisionRole) : division.divisionRole,
    preferredFormation: changes.formation
      ? (change.preferredFormation as DivisionFormation)
      : division.preferredFormation,
    lastReorganizationMonth: month,
    cohesion: SafeInt(clampScore(cohesion)),
    experience: SafeInt(clampScore(experience)),
    aggregateHash: "",
  };
  next.aggregateHash = divisionAggregateHash(next);
  return { division: next, changedRole: changes.role, changedFormation: changes.formation };
}

export interface DivisionSpeedAdvisory {
  readonly slowestShipId: string;
  readonly slowestSpeed: number;
  readonly fastestSpeed: number;
}

export function divisionSpeedAdvisory(
  division: Pick<PermanentDivision, "shipOrder">,
  shipsById: ReadonlyMap<string, Pick<Ship, "id" | "speed">>,
): DivisionSpeedAdvisory | null {
  let slowest: { id: string; speed: number } | undefined;
  let fastest: number | undefined;
  for (const shipId of division.shipOrder) {
    const ship = shipsById.get(shipId);
    if (ship === undefined) continue;
    const speed = ship.speed as number;
    if (slowest === undefined || speed < slowest.speed) slowest = { id: ship.id, speed };
    if (fastest === undefined || speed > fastest) fastest = speed;
  }
  if (slowest === undefined || fastest === undefined || fastest === slowest.speed) return null;
  return { slowestShipId: slowest.id, slowestSpeed: slowest.speed, fastestSpeed: fastest };
}
