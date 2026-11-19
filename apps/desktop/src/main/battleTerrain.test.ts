import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { TERRAIN_ARTIFACT_FILENAME, buildTerrainArtifact } from "@bluewave/content-compiler";
import type { CompiledTerrain } from "@bluewave/content-schema";

import { readBattleTerrain } from "./battleTerrain.js";
import { ContentArtifactError } from "./contentArtifact.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL fixture",
} as const;

const terrain: CompiledTerrain = {
  terrainVersion: 1,
  rules: { sectionVersion: 1, exclusionRadiusM: 400, maxVerticesPerPolygon: 8, provenance },
  records: [
    {
      areaId: "a_coast",
      box: { minXM: -5000, minYM: -5000, maxXM: 5000, maxYM: 5000 },
      battleOrigin: { xM: -2000, yM: -3000 },
      land: [
        {
          id: "isle",
          vertices: [
            { xM: 0, yM: 0 },
            { xM: 1000, yM: 0 },
            { xM: 1000, yM: 1000 },
          ],
        },
      ],
      shallows: [],
      exclusions: [{ id: "exclusion.p", portId: "p", xM: 1500, yM: 1500, radiusM: 400 }],
    },
  ],
};

const dirs: string[] = [];
function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "bluewave-terrain-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("readBattleTerrain", () => {
  it("yields no terrain when the content has no sidecar", () => {
    expect(readBattleTerrain(workDir())).toBeUndefined();
  });

  it("places each area record in the battle frame, keyed by area id", () => {
    const dir = workDir();
    writeFileSync(join(dir, TERRAIN_ARTIFACT_FILENAME), buildTerrainArtifact(terrain).artifactJson);
    const placed = readBattleTerrain(dir);
    expect(Object.keys(placed ?? {})).toEqual(["a_coast"]);
    expect(placed?.["a_coast"]?.land[0]?.vertices[0]).toEqual({ xM: 2000, yM: 3000 });
    expect(placed?.["a_coast"]?.exclusions[0]).toEqual({
      id: "exclusion.p",
      xM: 3500,
      yM: 4500,
      radiusM: 400,
    });
  });

  it("fails loudly on a tampered sidecar instead of silently dropping terrain", () => {
    const dir = workDir();
    const document = JSON.parse(buildTerrainArtifact(terrain).artifactJson);
    document.terrain.records[0].exclusions[0].radiusM = 401;
    writeFileSync(join(dir, TERRAIN_ARTIFACT_FILENAME), JSON.stringify(document));
    expect(() => readBattleTerrain(dir)).toThrow(ContentArtifactError);
  });

  it("fails loudly on unreadable json", () => {
    const dir = workDir();
    writeFileSync(join(dir, TERRAIN_ARTIFACT_FILENAME), "{");
    expect(() => readBattleTerrain(dir)).toThrow(ContentArtifactError);
  });
});
