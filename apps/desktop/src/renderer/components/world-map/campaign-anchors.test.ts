import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { decodeCoastline } from "../../lib/coastline-codec.js";
import { COASTLINE_BASE64 } from "./coastline-data.js";
import {
  AREA_ANCHORS,
  PORT_ANCHORS,
  areaAnchor,
  lanePath,
  portAnchor,
  type LonLat,
} from "./campaign-anchors.js";
import { LANE_WAYPOINTS } from "./lane-waypoints.js";

interface ArtifactSlice {
  readonly areas: readonly { readonly id: string }[];
  readonly ports: readonly { readonly id: string; readonly areaId: string }[];
  readonly routes: readonly {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly type: string;
  }[];
}

const artifact = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../../../../content/generated/1880/content-artifact.json"),
    "utf8",
  ),
) as ArtifactSlice;

const bytes = Buffer.from(COASTLINE_BASE64, "base64");
const land = decodeCoastline(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
);

function inRing(ring: readonly number[], x: number, y: number): boolean {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2] as number;
    const yi = ring[i * 2 + 1] as number;
    const xj = ring[j * 2] as number;
    const yj = ring[j * 2 + 1] as number;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function onLand(lon: number, lat: number): boolean {
  const x = ((((lon + 180) % 360) + 360) % 360) - 180;
  return land.some(
    (polygon) =>
      inRing(polygon[0] as number[], x, lat) &&
      !polygon.slice(1).some((hole) => inRing(hole, x, lat)),
  );
}

function landDegrees(path: readonly LonLat[]): number {
  let total = 0;
  for (let index = 0; index + 1 < path.length; index++) {
    const [x0, y0] = path[index] as LonLat;
    let [x1, y1] = path[index + 1] as LonLat;
    while (x1 - x0 > 180) x1 -= 360;
    while (x1 - x0 < -180) x1 += 360;
    const length = Math.hypot(x1 - x0, y1 - y0);
    const samples = Math.max(2, Math.ceil(length / 0.05));
    for (let step = 0; step <= samples; step++) {
      const lon = x0 + ((x1 - x0) * step) / samples;
      const lat = y0 + ((y1 - y0) * step) / samples;
      if (onLand(lon, lat)) total += length / samples;
    }
  }
  return total;
}

const NARROW_STRAIT_LANES: ReadonlySet<string> = new Set([
  "r_malta_constant",
  "r_med_black",
  "r_redsea_adden",
  "r_suez_canal",
  "r_x_jpn_inland_sea_jpn_home_coast",
]);
const OPEN_WATER_LAND_DEGREES = 0.35;
const NARROW_STRAIT_LAND_DEGREES = 2.5;

describe("campaign anchors", () => {
  it("anchors every campaign area", () => {
    const missing = artifact.areas.filter((area) => areaAnchor(area.id) === null);
    expect(missing).toEqual([]);
  });

  it("anchors no unknown area, port or lane", () => {
    const areas = new Set(artifact.areas.map((area) => area.id));
    const ports = new Set(artifact.ports.map((port) => port.id));
    const routes = new Set(artifact.routes.map((route) => route.id));
    expect(Object.keys(AREA_ANCHORS).filter((id) => !areas.has(id))).toEqual([]);
    expect(Object.keys(PORT_ANCHORS).filter((id) => !ports.has(id))).toEqual([]);
    expect(Object.keys(LANE_WAYPOINTS).filter((id) => !routes.has(id))).toEqual([]);
  });

  it("places every port at its own coordinates", () => {
    const missing = artifact.ports.filter((port) => PORT_ANCHORS[port.id] === undefined);
    expect(missing.map((port) => port.id)).toEqual([]);
  });

  it("spreads ports instead of stacking them on shared area points", () => {
    const positions = new Set(
      artifact.ports.map((port) => {
        const at = portAnchor(port.id, port.areaId) as LonLat;
        return `${at[0].toFixed(1)},${at[1].toFixed(1)}`;
      }),
    );
    expect(positions.size).toBeGreaterThanOrEqual(artifact.ports.length - 2);
  });

  it("keeps coordinates in range", () => {
    const all = [...Object.values(AREA_ANCHORS), ...Object.values(PORT_ANCHORS)];
    for (const [lon, lat] of all) {
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    }
  });

  it("puts every area anchor on water", () => {
    const stranded = artifact.areas
      .filter((area) => {
        const at = areaAnchor(area.id) as LonLat;
        return onLand(at[0], at[1]);
      })
      .map((area) => area.id);
    expect(stranded).toEqual([]);
  });

  it("routes every sea lane through water", () => {
    const wet: string[] = [];
    for (const route of artifact.routes) {
      if (route.type !== "sea") continue;
      const path = lanePath(route.id, route.from, route.to);
      expect(path, route.id).not.toBeNull();
      const limit = NARROW_STRAIT_LANES.has(route.id)
        ? NARROW_STRAIT_LAND_DEGREES
        : OPEN_WATER_LAND_DEGREES;
      const crossing = landDegrees(path as readonly LonLat[]);
      if (crossing > limit) wet.push(`${route.id} ${crossing.toFixed(2)}deg`);
    }
    expect(wet).toEqual([]);
  });

  it("starts and ends a lane at its area anchors", () => {
    const path = lanePath("r_chan_north", "sea_english_channel", "sea_north_sea") as LonLat[];
    expect(path[0]).toEqual(AREA_ANCHORS["sea_english_channel"]);
    expect(path[path.length - 1]).toEqual(AREA_ANCHORS["sea_north_sea"]);
    expect(path.length).toBeGreaterThan(2);
  });

  it("returns no path for an unknown area", () => {
    expect(lanePath("r_x", "nowhere", "sea_north_sea")).toBeNull();
  });
});
