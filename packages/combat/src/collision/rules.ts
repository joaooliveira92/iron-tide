import { CombatInvariantError } from "../errors.js";
import { compareStrings } from "../core/ordering.js";
import type { CollisionRules, CollisionShip, ShipCollisionContext } from "./model.js";

export const COLLISION_SHIP_DIMENSION_INVALID = "COLLISION_SHIP_DIMENSION_INVALID" as const;

export const PROVISIONAL_COLLISION_RULES: CollisionRules = {
  lengthShareBp: 3_000,
  beamShareBp: 2_000,
  speedCapBp: 5_000,
  speedCapSeconds: 600,
  structuralBase: 2_000,
  structuralPerMps: 1_500,
  flotationBase: 1_000,
  flotationPerMps: 4_000,
};

export interface DesignHullMm {
  readonly lengthMm: number;
  readonly beamMm: number;
}

export function projectShipCollisionContext(
  rules: CollisionRules,
  hulls: Readonly<Record<string, DesignHullMm>>,
): ShipCollisionContext {
  const ships: Record<string, CollisionShip> = {};
  for (const id of Object.keys(hulls).sort(compareStrings)) {
    const hull = hulls[id]!;
    if (!Number.isSafeInteger(hull.lengthMm) || !Number.isSafeInteger(hull.beamMm)) {
      throw new CombatInvariantError({
        message: "collision hull dimensions must be safe integer millimetres",
        code: COLLISION_SHIP_DIMENSION_INVALID,
        context: { assetId: id, lengthMm: hull.lengthMm, beamMm: hull.beamMm },
      });
    }
    ships[id] = {
      lengthM: Math.floor(hull.lengthMm / 1_000),
      beamM: Math.floor(hull.beamMm / 1_000),
    };
  }
  return { rules, ships };
}

export function collisionRadiusM(rules: CollisionRules, ship: CollisionShip): number {
  if (!Number.isSafeInteger(ship.lengthM) || !Number.isSafeInteger(ship.beamM)) {
    throw new CombatInvariantError({
      message: "collision ship dimensions must be safe integer metres",
      code: COLLISION_SHIP_DIMENSION_INVALID,
      context: { lengthM: ship.lengthM, beamM: ship.beamM },
    });
  }
  return Math.floor((ship.lengthM * rules.lengthShareBp + ship.beamM * rules.beamShareBp) / 10_000);
}
