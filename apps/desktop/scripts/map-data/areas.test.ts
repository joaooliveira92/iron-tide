import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { validateAreaOutlines, sharedBoundaries } from "./area-validate.ts";
import {
  canonicalAreaHash,
  decodeAreaSpec,
  prepareAreas,
  validateAreaSource,
  type AreaSource,
} from "./areas.ts";
import { bakeTiles } from "./bake.ts";
import { MapDataError } from "./errors.ts";
import { TEST_CONFIG, strait, straitCatalogue } from "./fixtures.ts";
import { areaTextHash } from "./pipeline.ts";
import { sha256Hex } from "./sources.ts";
import {
  TilePack,
  encodeTilePack,
  type TilePackTile,
} from "../../src/renderer/components/globe-spike/tilepack.ts";
import { AREAS } from "../../src/renderer/components/world-map/map-geometry.ts";

const SPEC_JSON: unknown = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "map-data", "area-outlines.v1.json"), "utf8"),
);
const spec = decodeAreaSpec(SPEC_JSON);
const sources: readonly AreaSource[] = AREAS.map((area) => ({
  id: area.id,
  name: area.short,
  ring: area.ring as AreaSource["ring"],
}));
const prepared = prepareAreas(sources, spec);

function specWith(overrides: Record<string, unknown>): unknown {
  return { ...(SPEC_JSON as Record<string, unknown>), ...overrides };
}

describe("area outline source and edge semantics", () => {
  it("accepts the pinned source: 36 areas whose canonical hash matches", () => {
    expect(() => validateAreaSource(sources, spec, areaTextHash)).not.toThrow();
    expect(sources).toHaveLength(36);
    expect(canonicalAreaHash(sources, areaTextHash)).toBe(spec.source.canonicalSha256);
  });

  it("requires explicit lonlat-linear semantics and rejects every other interpretation", () => {
    const { edgeSemantics: _omitted, ...unspecified } = SPEC_JSON as Record<string, unknown>;
    expect(() => decodeAreaSpec(unspecified)).toThrow(/declared explicitly/);
    for (const other of ["mercator-linear", "great-circle", "unspecified", "mixed", ""]) {
      expect(() => decodeAreaSpec(specWith({ edgeSemantics: other }))).toThrow(MapDataError);
    }
    expect(() => decodeAreaSpec(specWith({ densifyToleranceMetres: 0 }))).toThrow(MapDataError);
    expect(() => decodeAreaSpec(specWith({ schemaVersion: 2 }))).toThrow(/schemaVersion/);
  });

  it("rejects drifted, duplicated, degenerate or ambiguous source geometry", () => {
    const first = sources[0] as AreaSource;
    const moved = [{ ...first, ring: first.ring.map((p) => [p[0] + 0.001, p[1]] as const) }];
    const oneSpec = { ...spec, source: { ...spec.source, count: 1 } };
    expect(() => validateAreaSource(moved, oneSpec, areaTextHash)).toThrow(
      /does not match the pinned/,
    );
    expect(() => validateAreaSource(sources.slice(1), spec, areaTextHash)).toThrow(
      /35 areas found/,
    );
    const duplicated = [...sources.slice(0, 35), first];
    expect(() => validateAreaSource(duplicated, spec, areaTextHash)).toThrow(/duplicate id/);
    const wide: AreaSource = {
      id: "wide",
      name: "wide",
      ring: [
        [0, 0],
        [190, 0],
        [190, 10],
        [0, 10],
      ],
    };
    expect(() =>
      validateAreaSource([wide], { ...spec, source: { ...spec.source, count: 1 } }, areaTextHash),
    ).toThrow(/180 degrees/);
    const flat: AreaSource = {
      id: "flat",
      name: "flat",
      ring: [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
    };
    expect(() =>
      validateAreaSource([flat], { ...spec, source: { ...spec.source, count: 1 } }, areaTextHash),
    ).toThrow(MapDataError);
    const polar: AreaSource = {
      id: "polar",
      name: "polar",
      ring: [
        [0, 0],
        [10, 0],
        [10, 89],
      ],
    };
    expect(() =>
      validateAreaSource([polar], { ...spec, source: { ...spec.source, count: 1 } }, areaTextHash),
    ).toThrow(/outside the accepted range/);
  });
});

describe("densified area rings", () => {
  it("keeps every area id in a stable sorted order with stable ordinals", () => {
    const ids = prepared.map((area) => area.id);
    expect(ids).toEqual([...ids].sort());
    expect(prepared.map((area) => area.ordinal)).toEqual(ids.map((_, index) => index + 1));
    expect(JSON.stringify(prepareAreas([...sources].reverse(), spec))).toBe(
      JSON.stringify(prepared),
    );
  });

  it("preserves every source vertex, closes each ring and never repeats a vertex", () => {
    for (const area of prepared) {
      const keys = new Set(area.ring.map((p) => `${p[0]},${p[1]}`));
      for (const vertex of area.sourceRing)
        expect(keys.has(`${vertex[0]},${vertex[1]}`)).toBe(true);
      expect(area.ring[0]).toEqual(area.ring[area.ring.length - 1]);
      for (let index = 1; index < area.ring.length; index++) {
        const a = area.ring[index - 1] as readonly [number, number];
        const b = area.ring[index] as readonly [number, number];
        expect(a[0] === b[0] && a[1] === b[1]).toBe(false);
      }
    }
  });

  it("keeps unwrapped longitudes continuous across the antimeridian and bounds growth", () => {
    for (const area of prepared) {
      for (let index = 1; index < area.ring.length; index++) {
        const a = area.ring[index - 1] as readonly [number, number];
        const b = area.ring[index] as readonly [number, number];
        expect(Math.abs(b[0] - a[0])).toBeLessThan(180);
      }
      expect(area.ring.length).toBeLessThan(area.sourceRing.length * 400);
    }
    const southPacific = prepared.find((area) => area.id === "area_south_pacific");
    expect(Math.max(...(southPacific?.ring.map((p) => p[0]) ?? []))).toBe(255);
    const arctic = prepared.find((area) => area.id === "area_arctic_barents");
    expect(Math.max(...(arctic?.ring.map((p) => p[1]) ?? []))).toBe(84);
  });

  it("records the source orientation and keeps it independent of the tiler", () => {
    const orientations = new Set(prepared.map((area) => area.orientation));
    expect(orientations).toEqual(new Set(["clockwise", "counter-clockwise"]));
  });

  it("never self-intersects after densification", () => {
    const properly = (
      a: readonly [number, number],
      b: readonly [number, number],
      c: readonly [number, number],
      d: readonly [number, number],
    ): boolean => {
      const side = (
        p: readonly [number, number],
        q: readonly [number, number],
        r: readonly [number, number],
      ) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
    };
    for (const area of prepared) {
      const ring = area.ring as readonly (readonly [number, number])[];
      for (let i = 0; i + 1 < ring.length; i++) {
        for (let j = i + 2; j + 1 < ring.length; j++) {
          if (i === 0 && j + 1 === ring.length - 1) continue;
          expect(
            properly(
              ring[i] as never,
              ring[i + 1] as never,
              ring[j] as never,
              ring[j + 1] as never,
            ),
          ).toBe(false);
        }
      }
    }
  });

  it("finds ten collinear partial overlaps and no exactly shared edge", () => {
    const pairs = sharedBoundaries(prepared);
    expect(pairs).toHaveLength(10);
    const exact = pairs.filter(
      ({ a, b }) =>
        (a.from[0] === b.from[0] &&
          a.from[1] === b.from[1] &&
          a.to[0] === b.to[0] &&
          a.to[1] === b.to[1]) ||
        (a.from[0] === b.to[0] &&
          a.from[1] === b.to[1] &&
          a.to[0] === b.from[0] &&
          a.to[1] === b.from[1]),
    );
    expect(exact).toHaveLength(0);
  });
});

describe("baked area outline layers", () => {
  const catalogue = straitCatalogue(false);
  const geometry = { ...strait(true), areas: prepared };
  const output = bakeTiles(catalogue, geometry, TEST_CONFIG, sha256Hex);
  const pack = TilePack.parse(output.pack);

  function rebuilt(mutate: (tiles: TilePackTile[]) => TilePackTile[]): TilePack {
    const tiles = [...pack.entries()].map((entry) => ({
      z: entry.z,
      x: entry.x,
      y: entry.y,
      data: pack.read(entry).slice(),
    }));
    return TilePack.parse(encodeTilePack(mutate(tiles)));
  }

  it("passes every area check on the clean bake", () => {
    const report = validateAreaOutlines(pack, prepared, TEST_CONFIG);
    expect(report.findings).toEqual([]);
    expect(report.levels).toHaveLength(7);
    for (const level of report.levels) {
      expect(level.idsInFill).toBe(36);
      expect(level.idsInOutline).toBe(36);
    }
    expect(report.cracks.pairs).toBe(10);
    expect(report.cracks.worstUnits).toBeLessThanOrEqual(report.cracks.boundUnits);
    expect(report.fidelity.worstUnits).toBeLessThanOrEqual(report.fidelity.boundUnits);
    expect(report.outlineEdges.every((level) => level.mismatches === 0)).toBe(true);
    expect(report.fillEdges.every((level) => level.mismatches === 0)).toBe(true);
  });

  it("produces byte-identical packs on repeated clean bakes", () => {
    const again = bakeTiles(catalogue, geometry, TEST_CONFIG, sha256Hex);
    expect(sha256Hex(again.pack)).toBe(sha256Hex(output.pack));
    expect(again.levels.map((level) => level.sha256)).toEqual(
      output.levels.map((level) => level.sha256),
    );
  });

  it("counts area tiles and vertices per level", () => {
    for (const level of output.levels) {
      expect(level.areaTiles).toBeGreaterThan(0);
      expect(level.areaVertices).toBe(prepared.reduce((sum, area) => sum + area.ring.length, 0));
    }
  });

  it("reports a missing outline layer", () => {
    const without = bakeTiles(catalogue, { ...strait(true), areas: [] }, TEST_CONFIG, sha256Hex);
    const report = validateAreaOutlines(TilePack.parse(without.pack), prepared, TEST_CONFIG);
    const missing = report.findings.filter((f) => f.rule === "area-id-preserved");
    expect(missing.length).toBe(14);
    expect(report.passed).toBe(false);
  });

  it("reports a dropped tile as a tile-edge discontinuity", () => {
    const victim = [...pack.entries()].find(
      (entry) => entry.z === 5 && entry.x === 20 && entry.y === 18,
    );
    expect(victim).toBeDefined();
    const holed = rebuilt((tiles) =>
      tiles.filter((tile) => !(tile.z === 5 && tile.x === 20 && tile.y === 18)),
    );
    const report = validateAreaOutlines(holed, prepared, TEST_CONFIG);
    expect(report.findings.some((f) => f.rule === "tile-edge-continuity")).toBe(true);
  });

  it("reports a corrupt tile instead of passing silently", () => {
    const broken = rebuilt((tiles) =>
      tiles.map((tile) =>
        tile.z === 4 && tile.x === 8 && tile.y === 5
          ? { ...tile, data: Uint8Array.from([255, 255, 255]) }
          : tile,
      ),
    );
    expect(() => validateAreaOutlines(broken, prepared, TEST_CONFIG)).toThrow();
  });
});
