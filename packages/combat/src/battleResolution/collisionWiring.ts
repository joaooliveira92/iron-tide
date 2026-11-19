import {
  PROVISIONAL_COLLISION_RULES,
  projectShipCollisionContext,
  type CollisionContext,
  type CollisionRecord,
  type CollisionRules,
  type CollisionState,
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

export interface CollisionActivity {
  collisions: number;
  terrainBlocks: number;
}

export function observeCollisionRecords(
  activity: CollisionActivity,
  records: readonly CollisionRecord[] | undefined,
): void {
  for (const record of records ?? []) {
    if (record.kind === "COLLISION") activity.collisions += 1;
    else activity.terrainBlocks += 1;
  }
}

export function withCollisionActivity(
  collision: CollisionContext | undefined,
  activity: CollisionActivity,
): { collisionActivity?: CollisionActivity } {
  if (collision === undefined) return {};
  if (activity.collisions + activity.terrainBlocks === 0) return {};
  return { collisionActivity: { ...activity } };
}

export function withCollision(collision: CollisionContext | undefined): {
  collision?: CollisionContext;
} {
  return collision === undefined ? {} : { collision };
}

export function terrainOf(collision: CollisionContext | undefined): { terrain?: TerrainView } {
  return collision?.terrain === undefined ? {} : { terrain: collision.terrain };
}

export function carryCollisionState(
  collision: CollisionContext | undefined,
  state: CollisionState | undefined,
): CollisionContext | undefined {
  if (collision === undefined || state === undefined) return collision;
  return { ...collision, state };
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
