import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { Compiler, buildTerrainArtifact, verifyTerrainArtifact } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");
const manifestPath = resolve(contentDir, "pack.json");

function compileProduction(withTerrain: boolean) {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(manifestPath, contentDir, collector);
  const compiled = withTerrain ? input : { ...input!, terrainFiles: [] };
  const output = new Compiler().compile(compiled!, new AbortController().signal, collector);
  expect(collector.all.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
  return output!;
}

describe("1880 production terrain", () => {
  it("authors the Malta, Gibraltar and Cyprus coastal set with derived exclusions", () => {
    const terrain = compileProduction(true).terrain;
    expect(terrain?.records.map((r) => r.areaId)).toEqual([
      "med_cyprus",
      "med_gibraltar",
      "med_malta",
    ]);
    expect(terrain?.records.flatMap((r) => r.exclusions.map((e) => e.portId))).toEqual([
      "gbr_cyprus",
      "gbr_gibraltar",
      "gbr_valletta",
    ]);
    expect(terrain?.rules.exclusionRadiusM).toBe(600);
  }, 30_000);

  it("emits a sidecar artifact that verifies", () => {
    const terrain = compileProduction(true).terrain!;
    const artifact = buildTerrainArtifact(terrain);
    expect(verifyTerrainArtifact(JSON.parse(JSON.stringify(artifact))).ok).toBe(true);
  }, 30_000);

  it("leaves the content bundle hashes unchanged by authored terrain", () => {
    const withTerrain = compileProduction(true);
    const without = compileProduction(false);
    expect(without.terrain).toBeUndefined();
    expect(withTerrain.rawHash).toBe(without.rawHash);
    expect(withTerrain.envelopeHash).toBe(without.envelopeHash);
    expect(withTerrain.envelopeHash).toBe(
      "acc19ffc01ae095f4ab3924f562536ee898080772274f193dc12efd6a93a94ff",
    );
  }, 60_000);
});
