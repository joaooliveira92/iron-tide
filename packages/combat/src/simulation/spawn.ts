import type { MovementState } from "../movement/neighbour.js";
import type { TacticalSideId } from "../core/tacticalSideId.js";

export interface AreaBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpawnUnit {
  assetId: string;
  sideId: TacticalSideId;
  orderedSpeedBpKnots: number;
  designedSpeedBpKnots: number;
  turningRateMdegS: number;
}

export function computeInitialMovementStates(
  bbox: AreaBBox,
  units: SpawnUnit[],
): Record<string, MovementState> {
  const out: Record<string, MovementState> = {};
  const attackers = units.filter((u) => u.sideId === "ATTACKER");
  const defenders = units.filter((u) => u.sideId === "DEFENDER");
  const height = bbox.maxY - bbox.minY;
  const place = (us: SpawnUnit[], heading: number, xBase: number) => {
    const span = Math.max(1, us.length - 1);
    us.forEach((u, i) => {
      const y = bbox.minY + Math.round((height * i) / span);
      out[u.assetId] = {
        position: [Math.round(xBase), y],
        heading,
        orderedSpeed: u.orderedSpeedBpKnots,
        currentSpeed: u.orderedSpeedBpKnots,
        acceleration: 0,
        turningRate: u.turningRateMdegS,
        collisionRadius: 5_000_000,
        propulsionState: "steam",
        machineryReliability: 10_000,
        fuelState: "coal",
        formationStation: "LEAD",
      };
    });
  };
  place(attackers, 0, bbox.minX);
  place(defenders, 180, bbox.maxX);
  return out;
}
