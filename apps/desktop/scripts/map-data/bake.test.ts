import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { bakeTiles, resolveProtection } from "./bake.ts";
import { MapDataError } from "./errors.ts";
import { TEST_CONFIG, canalCatalogue, strait, straitCatalogue } from "./fixtures.ts";
import { sha256Hex } from "./sources.ts";
import { validateProtectedFeatures } from "./validate.ts";
import {
  TilePack,
  encodeTilePack,
  type TilePackTile,
} from "../../src/renderer/components/globe-spike/tilepack.ts";

function bakeAndValidate(
  openStrait: boolean,
  withFallback: boolean,
  mutate?: (tiles: TilePackTile[]) => TilePackTile[],
) {
  const catalogue = straitCatalogue(withFallback);
  const output = bakeTiles(catalogue, strait(openStrait), TEST_CONFIG, sha256Hex);
  let pack = TilePack.parse(output.pack);
  if (mutate !== undefined) {
    const tiles = [...pack.entries()].map((entry) => ({
      z: entry.z,
      x: entry.x,
      y: entry.y,
      data: pack.read(entry).slice(),
    }));
    pack = TilePack.parse(encodeTilePack(mutate(tiles)));
  }
  return {
    output,
    report: validateProtectedFeatures(pack, catalogue, output.resolution, TEST_CONFIG),
  };
}

describe("protected feature bake and validation", () => {
  it("keeps an open passage represented at every required level", () => {
    const { report } = bakeAndValidate(true, false);
    expect(report.findings).toEqual([]);
    const levels = report.results
      .filter((result) => result.featureId === "test-strait")
      .map((result) => result.level);
    expect(levels).toEqual([5, 6]);
  });

  it("fails explicitly when the base data seals a passage and no overlay exists", () => {
    expect(() => resolveProtection(straitCatalogue(false), strait(false), TEST_CONFIG)).toThrow(
      MapDataError,
    );
    expect(() => bakeTiles(straitCatalogue(false), strait(false), TEST_CONFIG, sha256Hex)).toThrow(
      /seals the passage/,
    );
  });

  it("injects the fallback overlay for a sealed passage and treats it as open in the validation view", () => {
    const { output, report } = bakeAndValidate(false, true);
    expect(output.resolution.overlays.map((overlay) => overlay.reason)).toEqual([
      "sealed-strait-fallback",
    ]);
    expect(report.findings).toEqual([]);
  });

  it("reports closure with the feature, level and rule when the overlay is missing from the tiles", () => {
    const { report } = bakeAndValidate(false, true, (tiles) =>
      tiles.map((tile) => ({ ...tile, data: stripProtectedLayer(tile) })),
    );
    const closure = report.findings.filter((finding) => finding.rule === "closure");
    expect(closure.length).toBeGreaterThan(0);
    expect(closure[0]?.featureId).toBe("test-strait");
    expect(closure.map((finding) => finding.level)).toEqual([5, 6]);
  });

  it("reports a tile-edge discontinuity when a neighbouring tile is dropped", () => {
    const { report } = bakeAndValidate(true, false, (tiles) => {
      const victim = tiles.find((tile) => tile.z === 4 && tile.x === 8 && tile.y === 8);
      return tiles.filter((tile) => tile !== victim);
    });
    const edge = report.findings.filter((finding) => finding.rule === "tile-edge-continuity");
    expect(edge.length).toBeGreaterThan(0);
    expect(edge[0]?.level).toBeGreaterThanOrEqual(0);
  });

  it("passes a canal overlay through a sealed isthmus and detects displacement and dropped tiles", () => {
    const catalogue = canalCatalogue();
    const output = bakeTiles(catalogue, strait(false), TEST_CONFIG, sha256Hex);
    const pack = TilePack.parse(output.pack);
    expect(
      validateProtectedFeatures(pack, catalogue, output.resolution, TEST_CONFIG).findings,
    ).toEqual([]);
    const shifted = {
      ...output.resolution,
      overlays: output.resolution.overlays.map((overlay) => ({
        ...overlay,
        lines: overlay.lines.map((line) =>
          line.map(([lon, lat]): [number, number] => [lon + 0.2, lat]),
        ),
      })),
    };
    const rules = new Set(
      validateProtectedFeatures(pack, catalogue, shifted, TEST_CONFIG).findings.map(
        (finding) => finding.rule,
      ),
    );
    expect(rules.has("orphan-segment")).toBe(true);
    expect(rules.has("max-displacement")).toBe(true);
    const tiles = [...pack.entries()].map((entry) => ({
      z: entry.z,
      x: entry.x,
      y: entry.y,
      data: pack.read(entry).slice(),
    }));
    const dropped = TilePack.parse(
      encodeTilePack(tiles.filter((tile) => !(tile.z === 6 && tile.x === 32 && tile.y === 31))),
    );
    const gaps = validateProtectedFeatures(
      dropped,
      catalogue,
      output.resolution,
      TEST_CONFIG,
    ).findings;
    expect(gaps.some((finding) => finding.featureId === "test-canal" && finding.level === 6)).toBe(
      true,
    );
  });

  it("is deterministic across repeated bakes", () => {
    const first = bakeTiles(straitCatalogue(true), strait(true), TEST_CONFIG, sha256Hex);
    const second = bakeTiles(straitCatalogue(true), strait(true), TEST_CONFIG, sha256Hex);
    expect(first.pack).toEqual(second.pack);
    expect(first.levels).toEqual(second.levels);
  });

  it("detects a corrupted pack on disk through the checksum", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bluewave-pack-"));
    try {
      const output = bakeTiles(straitCatalogue(true), strait(true), TEST_CONFIG, sha256Hex);
      const path = join(dir, "land.bwtp");
      const corrupt = output.pack.slice();
      corrupt[corrupt.length - 5] = (corrupt[corrupt.length - 5] ?? 0) ^ 0x55;
      await writeFile(path, corrupt);
      const parsed = TilePack.parse(new Uint8Array(await readFile(path)));
      const failures = [...parsed.entries()].filter((entry) => {
        try {
          parsed.read(entry);
          return false;
        } catch {
          return true;
        }
      });
      expect(failures.length).toBe(1);
      expect(sha256Hex(corrupt)).not.toBe(sha256Hex(output.pack));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function stripProtectedLayer(tile: TilePackTile): Uint8Array {
  return tile.data.length === 0 ? tile.data : removeLayer(tile.data, "protected");
}

function removeLayer(bytes: Uint8Array, name: string): Uint8Array {
  const out: number[] = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const start = cursor;
    const key = readVarint(bytes, cursor);
    cursor = key.next;
    const field = Number(key.value >> 3n);
    const wire = Number(key.value & 7n);
    if (wire === 2) {
      const length = readVarint(bytes, cursor);
      cursor = length.next;
      const end = cursor + Number(length.value);
      const body = bytes.subarray(cursor, end);
      cursor = end;
      if (field === 3 && layerName(body) === name) continue;
    } else if (wire === 0) {
      cursor = readVarint(bytes, cursor).next;
    } else {
      throw new MapDataError(`unexpected wire type ${wire}`);
    }
    for (let index = start; index < cursor; index++) out.push(bytes[index] as number);
  }
  return Uint8Array.from(out);
}

function layerName(body: Uint8Array): string {
  let cursor = 0;
  while (cursor < body.length) {
    const key = readVarint(body, cursor);
    cursor = key.next;
    const field = Number(key.value >> 3n);
    const wire = Number(key.value & 7n);
    if (wire === 2) {
      const length = readVarint(body, cursor);
      cursor = length.next;
      const end = cursor + Number(length.value);
      if (field === 1) return new TextDecoder().decode(body.subarray(cursor, end));
      cursor = end;
    } else if (wire === 0) {
      cursor = readVarint(body, cursor).next;
    } else {
      return "";
    }
  }
  return "";
}

function readVarint(bytes: Uint8Array, start: number): { value: bigint; next: number } {
  let value = 0n;
  let shift = 0n;
  let cursor = start;
  for (;;) {
    const byte = bytes[cursor] as number;
    cursor += 1;
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: cursor };
    shift += 7n;
  }
}
