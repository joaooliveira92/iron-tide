import { projectPoint, type Point, type Projection } from "./projection.js";

export interface PortMark {
  readonly id: string;
  readonly name: string;
  ux: number;
  uy: number;
  owner: string | null;
  major: boolean;
  count: number;
}

export interface FleetMark {
  readonly id: string;
  ux: number;
  uy: number;
  ships: number;
  owner: string | null;
  count: number;
}

export interface PossessionPlacement {
  readonly id: string;
  readonly name: string;
  readonly at: Point;
  readonly owner: string | null;
  readonly base: "major" | "minor";
}

export interface FleetPlacement {
  readonly id: string;
  readonly area: string;
  readonly at?: Point;
  readonly ships: number;
  readonly owner: string | null;
}

export type AreaAnchors = ReadonlyMap<string, Point>;

export function portSingles(
  possessions: readonly PossessionPlacement[],
  projection: Projection,
  centre: number,
): PortMark[] {
  return possessions.map((possession) => {
    const [ux, uy] = projectPoint(possession.at, projection, centre);
    return {
      id: possession.id,
      name: possession.name,
      ux,
      uy,
      owner: possession.owner,
      major: possession.base === "major",
      count: 1,
    };
  });
}

export function fleetSingles(
  fleets: readonly FleetPlacement[],
  anchors: AreaAnchors,
  locate?: (lonLat: Point) => Point,
): FleetMark[] {
  const singles: FleetMark[] = [];
  fleets.forEach((fleet, index) => {
    const anchor =
      fleet.at !== undefined && locate !== undefined ? locate(fleet.at) : anchors.get(fleet.area);
    if (anchor === undefined) return;
    singles.push({
      id: fleet.id,
      ux: anchor[0] + ((index % 3) * 16 - 16),
      uy: anchor[1] + 18,
      ships: fleet.ships,
      owner: fleet.owner,
      count: 1,
    });
  });
  return singles;
}

export function buildPortMarks(
  singles: readonly PortMark[],
  clustered: boolean,
  factor: number,
): PortMark[] {
  if (!clustered) return singles.map((mark) => ({ ...mark }));
  const radius = 14 / factor;
  const clusters: PortMark[] = [];
  for (const mark of singles) {
    const near = clusters.find(
      (cluster) => Math.hypot(cluster.ux - mark.ux, cluster.uy - mark.uy) < radius,
    );
    if (near === undefined) {
      clusters.push({ ...mark });
      continue;
    }
    const total = near.count + 1;
    near.ux = (near.ux * near.count + mark.ux) / total;
    near.uy = (near.uy * near.count + mark.uy) / total;
    near.owner = near.owner === mark.owner ? near.owner : null;
    near.major = near.major || mark.major;
    near.count = total;
  }
  return clusters;
}

export function buildFleetMarks(
  singles: readonly FleetMark[],
  clustered: boolean,
  factor: number,
  ports: readonly PortMark[],
): FleetMark[] {
  if (!clustered) return clearOfPorts(singles, ports, factor);
  const radius = 34 / factor;
  const clusters: FleetMark[] = [];
  for (const mark of singles) {
    const near = clusters.find(
      (cluster) => Math.hypot(cluster.ux - mark.ux, cluster.uy - mark.uy) < radius,
    );
    if (near === undefined) {
      clusters.push({ ...mark });
      continue;
    }
    const total = near.count + 1;
    near.ux = (near.ux * near.count + mark.ux) / total;
    near.uy = (near.uy * near.count + mark.uy) / total;
    near.ships += mark.ships;
    near.owner = near.owner === mark.owner ? near.owner : null;
    near.count = total;
  }
  return clearOfPorts(clusters, ports, factor);
}

export function clearOfPorts(
  fleets: readonly FleetMark[],
  ports: readonly PortMark[],
  factor: number,
): FleetMark[] {
  return fleets.map((fleet) => {
    const halfWidth = fleet.count > 1 ? 15 : 11;
    const moved = { ...fleet };
    for (let attempt = 0; attempt < 4; attempt++) {
      const hit = ports.some((port) => {
        const radius = port.count > 1 ? 9 : port.major ? 5 : 3.5;
        return (
          Math.abs(port.ux - moved.ux) * factor < radius + halfWidth &&
          Math.abs(port.uy - moved.uy) * factor < radius + 8
        );
      });
      if (!hit) break;
      moved.uy += 14 / factor;
    }
    return moved;
  });
}
