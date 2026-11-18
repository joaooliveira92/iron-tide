import { CombatInvariantError } from "../errors.js";
import type { CollisionRules, CollisionShip } from "./model.js";

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
