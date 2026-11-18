import {
  CompiledTerrainSchema,
  TERRAIN_ARTIFACT_KIND,
  TERRAIN_COMPATIBILITY_VERSION,
  TERRAIN_HASH_DOMAIN,
  validateAgainstSchema,
  type CompiledTerrain,
} from "@bluewave/content-schema";
import { canonicalSerialize, hashWithContext } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";

export const TERRAIN_ARTIFACT_FILENAME = "terrain-artifact.json";

export interface TerrainEnvelope {
  readonly algorithm: "sha256";
  readonly artifactKind: string;
  readonly compatibilityVersion: string;
  readonly hashDomain: string;
  readonly bodyHash: string;
  readonly bodyLength: number;
}

export interface TerrainArtifact {
  readonly terrain: CompiledTerrain;
  readonly envelope: TerrainEnvelope;
  readonly artifactJson: string;
}

export type TerrainVerification =
  | { readonly ok: true; readonly terrain: CompiledTerrain }
  | { readonly ok: false; readonly code: string; readonly message: string };

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

export function buildTerrainArtifact(terrain: CompiledTerrain): TerrainArtifact {
  const bodyJson = canonicalSerialize(terrain);
  const envelope: TerrainEnvelope = {
    algorithm: "sha256",
    artifactKind: TERRAIN_ARTIFACT_KIND,
    compatibilityVersion: TERRAIN_COMPATIBILITY_VERSION,
    hashDomain: TERRAIN_HASH_DOMAIN,
    bodyHash: hashWithContext(bodyJson, TERRAIN_HASH_DOMAIN),
    bodyLength: byteLength(bodyJson),
  };
  return { terrain, envelope, artifactJson: canonicalSerialize({ envelope, terrain }) };
}

export function verifyTerrainArtifact(document: unknown): TerrainVerification {
  if (typeof document !== "object" || document === null) {
    return {
      ok: false,
      code: "TERRAIN_ARTIFACT_INVALID",
      message: "The terrain artifact is not an object.",
    };
  }
  const { envelope, terrain } = document as { envelope?: unknown; terrain?: unknown };
  const decoded = validateAgainstSchema(
    terrain,
    CompiledTerrainSchema,
    "CompiledTerrain",
    TERRAIN_ARTIFACT_FILENAME,
    new DiagnosticCollector(),
  );
  if (decoded === undefined) {
    return {
      ok: false,
      code: "TERRAIN_ARTIFACT_INVALID",
      message: "The terrain body does not decode.",
    };
  }
  const bodyJson = canonicalSerialize(decoded);
  const expected = buildTerrainArtifact(decoded).envelope;
  if (canonicalSerialize(envelope) !== canonicalSerialize(expected)) {
    return {
      ok: false,
      code: "TERRAIN_ARTIFACT_HASH_MISMATCH",
      message: `The terrain envelope does not match its body (${byteLength(bodyJson)} bytes, domain ${TERRAIN_HASH_DOMAIN}).`,
    };
  }
  return { ok: true, terrain: decoded };
}
