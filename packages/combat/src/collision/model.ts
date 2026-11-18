import type { TerrainView } from "../terrain/index.js";

export interface CollisionRules {
  readonly lengthShareBp: number;
  readonly beamShareBp: number;
  readonly speedCapBp: number;
  readonly speedCapSeconds: number;
  readonly structuralBase: number;
  readonly structuralPerMps: number;
  readonly flotationBase: number;
  readonly flotationPerMps: number;
}

export interface CollisionShip {
  readonly lengthM: number;
  readonly beamM: number;
}

export interface ShipCollisionContext {
  readonly rules: CollisionRules;
  readonly ships: Readonly<Record<string, CollisionShip>>;
}

export interface SpeedCap {
  readonly capBp: number;
  readonly remainingSeconds: number;
}

export interface CollisionState {
  readonly speedCaps: Readonly<Record<string, SpeedCap>>;
  readonly inContact: readonly string[];
}

export interface CollisionContext {
  readonly terrain?: TerrainView;
  readonly shipCollision?: ShipCollisionContext;
  readonly state?: CollisionState;
}

export interface CollisionRecord {
  readonly kind: "COLLISION" | "TERRAIN_BLOCKED";
  readonly minute: number;
  readonly substep: number;
  readonly shipAId: string;
  readonly shipBId: string;
  readonly closingSpeedMps: number;
  readonly bearingDeg: number;
}
