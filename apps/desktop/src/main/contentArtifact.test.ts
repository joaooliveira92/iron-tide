import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  CONTENT_ARTIFACT_FILENAME,
  CONTENT_BUNDLE_ARTIFACT_KIND,
  CONTENT_BUNDLE_COMPATIBILITY_VERSION,
  CONTENT_MANIFEST_FILENAME,
  buildContentBundleArtifact,
  writeContentBundleArtifact,
} from "@bluewave/content-compiler";

import { canonicalSerialize, createEnvelope } from "@bluewave/deterministic";

import { DiagnosticCollector } from "@bluewave/diagnostics";

import { compileProductionCampaignFromArtifact } from "./compiler.js";
import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

const scratchDirs: string[] = [];

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A private copy of the generated artifact so a test can tamper without touching the shared build. */
function copyArtifact(): string {
  const source = resolveGeneratedContentDir();
  const dir = mkdtempSync(join(tmpdir(), "bw-artifact-"));
  scratchDirs.push(dir);
  writeFileSync(
    join(dir, CONTENT_ARTIFACT_FILENAME),
    readFileSync(join(source, CONTENT_ARTIFACT_FILENAME), "utf8"),
  );
  writeFileSync(
    join(dir, CONTENT_MANIFEST_FILENAME),
    readFileSync(join(source, CONTENT_MANIFEST_FILENAME), "utf8"),
  );
  return dir;
}

function expectError(fn: () => unknown): ContentArtifactError {
  try {
    fn();
  } catch (error) {
    expect(ContentArtifactError.is(error)).toBe(true);
    return error as ContentArtifactError;
  }
  throw new Error("expected readContentArtifact to throw");
}

describe("compiled content artifact loader (ticket 03)", () => {
  it("loads and verifies the shipped production artifact", () => {
    const { bundle, manifest } = readContentArtifact(resolveGeneratedContentDir());
    expect(typeof manifest.bodyHash).toBe("string");
    expect(manifest.bodyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(bundle.shipBuilding).toBeDefined();
    expect(Array.isArray(bundle.technologies)).toBe(true);
  });

  it("fails closed when the artifact is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-artifact-empty-"));
    scratchDirs.push(dir);
    expect(expectError(() => readContentArtifact(dir)).code).toBe("CONTENT_ARTIFACT_MISSING");
  });

  it("fails closed when the artifact bytes are tampered (hash mismatch)", () => {
    const dir = copyArtifact();
    const artifactPath = join(dir, CONTENT_ARTIFACT_FILENAME);
    const value = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
    value.tampered = true;
    writeFileSync(artifactPath, JSON.stringify(value), "utf8");
    const error = expectError(() => readContentArtifact(dir));
    expect(error.code).toBe("CONTENT_ARTIFACT_INVALID");
    expect(error.reason).toBe("CONTENT_ARTIFACT_HASH_MISMATCH");
  });

  it("fails closed on a manifest version mismatch", () => {
    const dir = copyArtifact();
    const manifestPath = join(dir, CONTENT_MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.compatibilityVersion = "9.9.9";
    writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
    const error = expectError(() => readContentArtifact(dir));
    expect(error.code).toBe("CONTENT_ARTIFACT_INVALID");
    expect(error.reason).toBe("CONTENT_ARTIFACT_VERSION_MISMATCH");
  });

  it("fails closed when the manifest content version disagrees with the bundle", () => {
    const dir = copyArtifact();
    const manifestPath = join(dir, CONTENT_MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.contentVersion = "999.0.0";
    writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
    const error = expectError(() => readContentArtifact(dir));
    expect(error.code).toBe("CONTENT_ARTIFACT_INVALID");
    expect(error.reason).toBe("CONTENT_VERSION_MISMATCH");
  });

  it("fails closed when the do-not-edit marker is stripped", () => {
    const dir = copyArtifact();
    const manifestPath = join(dir, CONTENT_MANIFEST_FILENAME);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.doNotEdit = "";
    writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
    expect(expectError(() => readContentArtifact(dir)).code).toBe("CONTENT_ARTIFACT_INVALID");
  });

  it("fails closed when the bundle hash-verifies but violates its content schema", () => {
    const dir = copyArtifact();
    const artifactPath = join(dir, CONTENT_ARTIFACT_FILENAME);
    const manifestPath = join(dir, CONTENT_MANIFEST_FILENAME);

    const bundle = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
    const nations = bundle.nations as Record<string, unknown>[];
    nations[0] = { ...nations[0], __schemaDrift: true };

    // Re-pin the manifest to the tampered bundle so the hash check passes and
    // only the schema decode can catch the drift (CAH-SCH-3).
    const envelope = createEnvelope(
      CONTENT_BUNDLE_ARTIFACT_KIND,
      CONTENT_BUNDLE_COMPATIBILITY_VERSION,
      bundle,
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.bodyHash = envelope.bodyHash;
    manifest.bodyLength = envelope.bodyLength;
    writeFileSync(artifactPath, canonicalSerialize(bundle), "utf8");
    writeFileSync(manifestPath, canonicalSerialize(manifest), "utf8");

    const error = expectError(() => readContentArtifact(dir));
    expect(error.code).toBe("CONTENT_ARTIFACT_INVALID");
    expect(error.reason).toBe("CONTENT_ARTIFACT_SCHEMA_MISMATCH");
  });
});

describe("campaign compile from the verified artifact (ticket 07)", () => {
  it("carries the campaign-file collections in the bundle", () => {
    const { bundle } = readContentArtifact(resolveGeneratedContentDir());
    const campaign = bundle.campaign;
    expect(campaign).toBeDefined();
    expect(campaign!.fleets.length).toBeGreaterThan(0);
    expect(campaign!.designs.length).toBeGreaterThan(0);
    expect(campaign!.economies.length).toBeGreaterThan(0);
  });

  it("compiles a campaign from the artifact with an artifact-derived identity", () => {
    const dir = resolveGeneratedContentDir();
    const { manifest } = readContentArtifact(dir);
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      dir,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    expect(output).toBeDefined();
    // Identity is exactly the verified artifact body hash, never raw file bytes.
    expect(output!.contentHash).toBe(manifest.bodyHash);
    expect(output!.state.snapshot.nations.size).toBeGreaterThan(0);
  });

  it("fails closed before month execution on a tampered artifact", () => {
    const dir = copyArtifact();
    const artifactPath = join(dir, CONTENT_ARTIFACT_FILENAME);
    const value = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
    (value as { campaign?: { fleets: unknown[] } }).campaign = { fleets: [] };
    writeFileSync(artifactPath, JSON.stringify(value), "utf8");

    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      dir,
      new AbortController().signal,
      collector,
    );
    expect(output).toBeUndefined();
    expect(collector.all.some((d) => d.code === "CONTENT_ARTIFACT_INVALID")).toBe(true);
  });

  it("fails closed on a content-pack-only artifact with no campaign section", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-artifact-nocampaign-"));
    scratchDirs.push(dir);
    writeFileSync(
      join(dir, "pack.json"),
      JSON.stringify({ name: "x", version: "0.1.0", type: "fixture", files: {} }),
      "utf8",
    );
    const buildCollector = new DiagnosticCollector();
    const artifact = buildContentBundleArtifact(
      {
        manifestPath: join(dir, "pack.json"),
        contentDir: dir,
        rulesetFiles: [],
        countryFiles: [],
        areaFiles: [],
        routeFiles: [],
        possessionFiles: [],
        portFiles: [],
        technologyFiles: [],
      },
      new AbortController().signal,
      buildCollector,
    );
    expect(artifact).toBeDefined();
    writeContentBundleArtifact(dir, artifact!);

    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      dir,
      new AbortController().signal,
      collector,
    );
    expect(output).toBeUndefined();
    expect(collector.all.some((d) => d.code === "CONTENT_ARTIFACT_INVALID")).toBe(true);
  });
});
