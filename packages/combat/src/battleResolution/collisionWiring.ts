import {
  PROVISIONAL_COLLISION_RULES,
  projectShipCollisionContext,
  type CollisionContext,
  type CollisionRules,
  type DesignHullMm,
} from "../collision/index.js";
import type { TerrainView } from "../terrain/index.js";

export interface HullDimensioned {
  readonly hullLengthMm?: number;
  readonly hullBeamMm?: number;
}

export interface BattleCollisionInput {
  readonly designs: Readonly<Record<string, HullDimensioned>>;
  readonly terrain?: TerrainView | undefined;
  readonly rules?: CollisionRules | undefined;
}

export function projectBattleCollision(input: BattleCollisionInput): CollisionContext | undefined {
  const hulls: Record<string, DesignHullMm> = {};
  for (const [assetId, design] of Object.entries(input.designs)) {
    if (design.hullLengthMm === undefined || design.hullBeamMm === undefined) continue;
    hulls[assetId] = { lengthMm: design.hullLengthMm, beamMm: design.hullBeamMm };
  }
  const rules = input.rules ?? PROVISIONAL_COLLISION_RULES;
  const hasShips = Object.keys(hulls).length > 0;
  if (!hasShips && input.terrain === undefined) return undefined;
  return {
    ...(input.terrain === undefined ? {} : { terrain: input.terrain }),
    ...(hasShips ? { shipCollision: projectShipCollisionContext(rules, hulls) } : {}),
  };
}
