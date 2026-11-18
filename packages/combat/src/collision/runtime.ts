import type { BattleEvent } from "../core/battleLedger.js";
import { compareStrings } from "../core/ordering.js";
import type { GunneryImpact } from "../damage/engineWiring.js";
import { headingToward } from "../battleResolution/engagement.js";
import { resolvePropulsion } from "../movement/kinematics.js";
import type { MovementState } from "../movement/state.js";
import { floorMetres, pointInNoGoZone } from "../terrain/index.js";
import { buildCollisionImpact } from "./impact.js";
import type { CollisionContext, CollisionRecord, CollisionState, SpeedCap } from "./model.js";
import { collisionRadiusM } from "./rules.js";

export const COLLISION_EVENT_TYPE = "collision" as const;
export const TERRAIN_BLOCKED_EVENT_TYPE = "terrain_blocked" as const;
export const COLLISION_EVENT_PRIORITY = 7 as const;

export interface HazardOutcome {
  readonly records: readonly CollisionRecord[];
  readonly events: readonly BattleEvent[];
  readonly impacts: Readonly<Record<string, readonly GunneryImpact[]>>;
  readonly state: CollisionState;
}

export interface MovementHazards {
  limitSpeed(assetId: string, attainableBp: number): number;
  beginSubstep(movements: Readonly<Record<string, MovementState>>): void;
  admit(
    assetId: string,
    movement: MovementState,
    next: [number, number],
    speedBefore: number,
    substep: number,
  ): [number, number];
  endSubstep(substep: number, movements: Readonly<Record<string, MovementState>>): void;
  finish(): HazardOutcome;
}

type MetrePoint = readonly [number, number];

function metres(position: readonly [number, number]): MetrePoint {
  return [floorMetres(position[0]), floorMetres(position[1])];
}

function squaredDistance(a: MetrePoint, b: MetrePoint): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function event(
  battleId: string,
  minute: number,
  substep: number,
  eventType: string,
  actorId: string,
  targetId: string,
): BattleEvent {
  return {
    battleId,
    minute,
    substep,
    eventPriority: COLLISION_EVENT_PRIORITY,
    actorId,
    targetId,
    eventId: `${battleId}:${minute}:${substep}:${eventType}:${actorId}:${targetId}`,
    eventType,
  };
}

export function createMovementHazards(
  context: CollisionContext | undefined,
  battleId: string,
  minute: number,
): MovementHazards | undefined {
  if (!context) return undefined;
  const terrain = context.terrain;
  const shipCollision = context.shipCollision;
  const caps: Record<string, SpeedCap> = { ...context.state?.speedCaps };
  const inContact = new Set(context.state?.inContact ?? []);
  const radii = new Map<string, number>();
  if (shipCollision) {
    for (const id of Object.keys(shipCollision.ships).sort(compareStrings)) {
      radii.set(id, collisionRadiusM(shipCollision.rules, shipCollision.ships[id]!));
    }
  }
  const records: CollisionRecord[] = [];
  const events: BattleEvent[] = [];
  const impacts: Record<string, GunneryImpact[]> = {};
  const blocked = new Set<string>();
  let before = new Map<string, MetrePoint>();

  const detect = (substep: number, movements: Readonly<Record<string, MovementState>>) => {
    if (!shipCollision) return;
    const rules = shipCollision.rules;
    const ids = [...radii.keys()].filter((id) => movements[id] !== undefined);
    for (const id of Object.keys(caps)) {
      const cap = caps[id]!;
      if (cap.remainingSeconds <= 1) delete caps[id];
      else caps[id] = { capBp: cap.capBp, remainingSeconds: cap.remainingSeconds - 1 };
    }
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = `${a}|${b}`;
        const here = metres(movements[a]!.position);
        const there = metres(movements[b]!.position);
        const reach = radii.get(a)! + radii.get(b)!;
        const nowSquared = squaredDistance(here, there);
        if (nowSquared >= reach * reach) {
          inContact.delete(key);
          continue;
        }
        if (inContact.has(key)) continue;
        inContact.add(key);
        const priorA = before.get(a) ?? here;
        const priorB = before.get(b) ?? there;
        const closingSpeedMps = Math.max(
          0,
          Math.floor(Math.sqrt(squaredDistance(priorA, priorB))) -
            Math.floor(Math.sqrt(nowSquared)),
        );
        const bearingDeg = headingToward(there[0] - here[0], there[1] - here[1]);
        records.push({
          kind: "COLLISION",
          minute,
          substep,
          shipAId: a,
          shipBId: b,
          closingSpeedMps,
          bearingDeg,
        });
        events.push(event(battleId, minute, substep, COLLISION_EVENT_TYPE, a, b));
        for (const [target, source] of [
          [a, b],
          [b, a],
        ] as const) {
          caps[target] = { capBp: rules.speedCapBp, remainingSeconds: rules.speedCapSeconds };
          (impacts[target] ??= []).push(
            buildCollisionImpact(rules, source, target, closingSpeedMps),
          );
        }
      }
    }
  };

  return {
    limitSpeed(assetId, attainableBp) {
      const cap = caps[assetId];
      return cap ? Math.min(attainableBp, cap.capBp) : attainableBp;
    },
    beginSubstep(movements) {
      before = new Map();
      for (const id of radii.keys()) {
        const m = movements[id];
        if (m) before.set(id, metres(m.position));
      }
    },
    admit(assetId, movement, next, speedBefore, substep) {
      if (!terrain) return next;
      if (pointInNoGoZone(terrain, movement.position) || !pointInNoGoZone(terrain, next)) {
        return next;
      }
      movement.currentSpeed = resolvePropulsion({
        currentSpeed: speedBefore,
        orderedSpeed: 0,
        dtSeconds: 1,
      });
      if (!blocked.has(assetId)) {
        blocked.add(assetId);
        records.push({
          kind: "TERRAIN_BLOCKED",
          minute,
          substep,
          shipAId: assetId,
          shipBId: "",
          closingSpeedMps: 0,
          bearingDeg: movement.heading,
        });
        events.push(event(battleId, minute, substep, TERRAIN_BLOCKED_EVENT_TYPE, assetId, ""));
      }
      return [movement.position[0], movement.position[1]];
    },
    endSubstep: detect,
    finish() {
      return {
        records,
        events,
        impacts,
        state: { speedCaps: caps, inContact: [...inContact].sort(compareStrings) },
      };
    },
  };
}
