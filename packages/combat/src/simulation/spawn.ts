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

export interface SpawnSetup {
  startRangeUm?: number | undefined;
}

export function computeInitialMovementStates(
  bbox: AreaBBox,
  units: SpawnUnit[],
  setup?: SpawnSetup,
): Record<string, MovementState> {
  const out: Record<string, MovementState> = {};
  const attackers = units.filter((u) => u.sideId === "ATTACKER");
  const defenders = units.filter((u) => u.sideId === "DEFENDER");
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const startRangeUm =
    setup?.startRangeUm === undefined ? undefined : Math.min(setup.startRangeUm, width);
  const midX = bbox.minX + Math.floor(width / 2);
  const midY = bbox.minY + Math.floor(height / 2);
  const lineAbreastUm = startRangeUm === undefined ? 0 : Math.floor(startRangeUm / 4);
  const xGapUm = startRangeUm === undefined ? 0 : Math.floor((startRangeUm * 9) / 10);
  const place = (us: SpawnUnit[], heading: number, xBase: number) => {
    const span = Math.max(1, us.length - 1);
    us.forEach((u, i) => {
      const y =
        startRangeUm === undefined
          ? bbox.minY + Math.round((height * i) / span)
          : midY + Math.round((lineAbreastUm * (2 * i - (us.length - 1))) / (2 * span));
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
  place(attackers, 0, startRangeUm === undefined ? bbox.minX : midX - Math.floor(xGapUm / 2));
  place(defenders, 180, startRangeUm === undefined ? bbox.maxX : midX + Math.ceil(xGapUm / 2));
  return out;
}
