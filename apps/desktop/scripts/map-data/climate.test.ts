import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { bakeTiles } from "./bake.ts";
import {
  CLIMATE_BINARY_FILE,
  CLIMATE_PROVENANCE_FILE,
  decodeClimate,
  encodeClimate,
  loadClimate,
  type ClimateZoneGeometry,
} from "./climate-data.ts";
import { CLIMATE_ZONES, zoneOfKoppen } from "./climate-zones.ts";
import { MapDataIntegrityError } from "./errors.ts";
import { TEST_CONFIG, straitCatalogue, strait } from "./fixtures.ts";
import { decodeTile } from "./mvt.ts";
import { sha256Hex } from "./sources.ts";
import { TilePack } from "../../src/renderer/components/globe-spike/tilepack.ts";

const SAMPLE: readonly ClimateZoneGeometry[] = [
  {
    zone: 5,
    polygons: [
      [
        [
          [-1.5, -0.5],
          [1.5, -0.5],
          [1.5, 0.5],
          [-1.5, 0.5],
          [-1.5, -0.5],
        ],
      ],
    ],
  },
  {
    zone: 3,
    polygons: [
      [
        [
          [-0.5, -0.25],
          [0.5, -0.25],
          [0.5, 0.25],
          [-0.5, 0.25],
          [-0.5, -0.25],
        ],
      ],
    ],
  },
];

const rectangle = (west: number, south: number, east: number, north: number) =>
  [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ] as [number, number][];

const BAKE_SAMPLE: readonly ClimateZoneGeometry[] = [
  { zone: 5, polygons: [[rectangle(-60, -30, 60, 30)]] },
  { zone: 3, polygons: [[rectangle(-20, -10, 20, 10)]] },
];

describe("climate zone classification", () => {
  it("maps all thirty Koppen classes into the presentation zones and rejects no-data", () => {
    for (let value = 1; value <= 30; value++) {
      expect(zoneOfKoppen(value)).toBeGreaterThan(0);
    }
    expect(zoneOfKoppen(0)).toBe(0);
    expect(zoneOfKoppen(31)).toBe(0);
    expect(zoneOfKoppen(1)).toBe(zoneOfKoppen(2));
    expect(zoneOfKoppen(4)).toBe(zoneOfKoppen(5));
    expect(zoneOfKoppen(14)).toBe(zoneOfKoppen(8));
    expect(zoneOfKoppen(29)).toBe(zoneOfKoppen(30));
    expect(new Set(CLIMATE_ZONES.map((zone) => zone.id)).size).toBe(CLIMATE_ZONES.length);
  });
});

describe("climate geometry codec", () => {
  it("round-trips geometry on the 0.01 degree grid", () => {
    expect(decodeClimate(encodeClimate(SAMPLE))).toEqual(SAMPLE);
  });

  it("is deterministic", () => {
    expect(encodeClimate(SAMPLE)).toEqual(encodeClimate(SAMPLE));
  });

  it("rejects bytes without the climate header", () => {
    expect(() => decodeClimate(Uint8Array.from([1, 2, 3, 4, 0]))).toThrow(/bad header/);
  });

  it("refuses a binary whose hash differs from the provenance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bluewave-climate-"));
    try {
      const bytes = encodeClimate(SAMPLE);
      await writeFile(join(dir, CLIMATE_BINARY_FILE), bytes);
      await writeFile(
        join(dir, CLIMATE_PROVENANCE_FILE),
        JSON.stringify({
          schemaVersion: 1,
          binarySha256: sha256Hex(Uint8Array.from([0])),
          binaryBytes: bytes.length,
          source: {},
          method: {},
          zones: [],
        }),
      );
      await expect(loadClimate(dir)).rejects.toThrow(MapDataIntegrityError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads a binary that matches its provenance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bluewave-climate-"));
    try {
      const bytes = encodeClimate(SAMPLE);
      await writeFile(join(dir, CLIMATE_BINARY_FILE), bytes);
      await writeFile(
        join(dir, CLIMATE_PROVENANCE_FILE),
        JSON.stringify({
          schemaVersion: 1,
          binarySha256: sha256Hex(bytes),
          binaryBytes: bytes.length,
          source: {},
          method: {},
          zones: [],
        }),
      );
      expect((await loadClimate(dir)).geometry).toEqual(SAMPLE);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("climate layer bake", () => {
  it("tiles each zone into the climate layer in zone order with its zone property", () => {
    const output = bakeTiles(
      straitCatalogue(true),
      { ...strait(true), climate: BAKE_SAMPLE },
      TEST_CONFIG,
      sha256Hex,
    );
    const pack = TilePack.parse(output.pack);
    const zones: number[] = [];
    for (const entry of pack.entries()) {
      if (entry.z !== 0) continue;
      const decoded = decodeTile(pack.read(entry));
      for (const feature of decoded.layers.get(TEST_CONFIG.layers.climate) ?? []) {
        zones.push(feature.properties.zone as number);
      }
    }
    expect(zones).toEqual([5, 3]);
  });

  it("leaves the land layer unchanged when climate zones are added", () => {
    const without = bakeTiles(straitCatalogue(true), strait(true), TEST_CONFIG, sha256Hex);
    const withZones = bakeTiles(
      straitCatalogue(true),
      { ...strait(true), climate: BAKE_SAMPLE },
      TEST_CONFIG,
      sha256Hex,
    );
    const landOf = (output: { readonly pack: Uint8Array }): string => {
      const pack = TilePack.parse(output.pack);
      const parts: string[] = [];
      for (const entry of pack.entries()) {
        const land = decodeTile(pack.read(entry)).layers.get(TEST_CONFIG.layers.land);
        if (land === undefined) continue;
        parts.push(`${entry.z}/${entry.x}/${entry.y}:${JSON.stringify(land)}`);
      }
      return sha256Hex(parts.join("\n"));
    };
    expect(landOf(withZones)).toBe(landOf(without));
  });
});
