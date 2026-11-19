import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { placeBattleTerrain, type TerrainView } from "@bluewave/combat/terrain";
import { TERRAIN_ARTIFACT_FILENAME, verifyTerrainArtifact } from "@bluewave/content-compiler";

import { ContentArtifactError } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

export type BattleTerrainByArea = Readonly<Record<string, TerrainView>>;

export function readBattleTerrain(dir: string): BattleTerrainByArea | undefined {
  const path = join(dir, TERRAIN_ARTIFACT_FILENAME);
  if (!existsSync(path)) return undefined;
  let document: unknown;
  try {
    document = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_UNREADABLE",
      `The terrain artifact at ${path} is unreadable: ${message}`,
    );
  }
  const verification = verifyTerrainArtifact(document);
  if (!verification.ok) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `The terrain artifact at ${path} failed verification: ${verification.message}`,
      verification.code,
    );
  }
  const placed: Record<string, TerrainView> = {};
  for (const record of verification.terrain.records) {
    placed[record.areaId] = placeBattleTerrain(record);
  }
  return placed;
}

let cached: { readonly terrain: BattleTerrainByArea | undefined } | null = null;

export function loadBattleTerrain(): BattleTerrainByArea | undefined {
  if (cached !== null) return cached.terrain;
  cached = { terrain: readBattleTerrain(resolveGeneratedContentDir()) };
  return cached.terrain;
}
