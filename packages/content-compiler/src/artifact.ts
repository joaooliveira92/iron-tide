import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ContentBundleSchema,
  validateAgainstSchema,
  type CompiledContentBundle,
} from "@bluewave/content-schema";
import { canonicalSerialize, createEnvelope, verifyEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Predicate, Result, Schema } from "effect";

import { Compiler } from "./compiler.js";
import type { CompilerInput } from "./index.js";
import { BUNDLE_GENERATED_BY } from "./stages/compile.js";

export const CONTENT_BUNDLE_ARTIFACT_KIND = "content-bundle";
export const CONTENT_BUNDLE_COMPATIBILITY_VERSION = "0.1.0";
export const CONTENT_BUNDLE_MANIFEST_VERSION = 1;
export const CONTENT_ARTIFACT_FILENAME = "content-artifact.json";
export const CONTENT_MANIFEST_FILENAME = "content-manifest.json";
export const CONTENT_LOCK_FILENAME = "content-lock.json";

export interface ContentBundleManifest {
  readonly manifestVersion: number;
  readonly doNotEdit: string;
  readonly contentVersion: string;
  readonly artifactKind: string;
  readonly compatibilityVersion: string;
  readonly algorithm: string;
  readonly bodyHash: string;
  readonly bodyLength: number;
}

const ContentBundleManifestSchema = Schema.Struct({
  manifestVersion: Schema.Literal(CONTENT_BUNDLE_MANIFEST_VERSION),
  doNotEdit: Schema.String,
  contentVersion: Schema.String,
  artifactKind: Schema.String,
  compatibilityVersion: Schema.String,
  algorithm: Schema.String,
  bodyHash: Schema.String,
  bodyLength: Schema.Number,
});

const ContentLockSchema = Schema.Struct({
  contentVersion: Schema.String,
  bodyHash: Schema.String,
  algorithm: Schema.String,
});

const decodeManifest = Schema.decodeUnknownResult(ContentBundleManifestSchema);
const decodeLock = Schema.decodeUnknownResult(ContentLockSchema);

export interface ContentBundleArtifact {
  readonly bundle: CompiledContentBundle;
  readonly envelope: {
    readonly algorithm: string;
    readonly artifactKind: string;
    readonly compatibilityVersion: string;
    readonly bodyHash: string;
    readonly bodyLength: number;
  };
  readonly manifest: ContentBundleManifest;
  readonly contentVersion: string;
  readonly artifactJson: string;
  readonly manifestJson: string;
}

export type ContentBundleVerification =
  | {
      readonly ok: true;
      readonly bundle: CompiledContentBundle;
      readonly manifest: ContentBundleManifest;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface ContentLock {
  readonly contentVersion: string;
  readonly bodyHash: string;
  readonly algorithm: string;
}

export type ContentLockVerification =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly expected?: string;
      readonly actual?: string;
    };

export function verifyContentLock(
  artifact: ContentBundleArtifact,
  lock: unknown,
): ContentLockVerification {
  if (!Predicate.isObject(lock)) {
    return {
      ok: false,
      code: "CONTENT_LOCK_INVALID",
      message: "The content lock is not an object.",
    };
  }
  const decodedLock = decodeLock(lock);
  if (!Result.isSuccess(decodedLock)) {
    return {
      ok: false,
      code: "CONTENT_LOCK_INVALID",
      message:
        "The content lock must carry string 'contentVersion', 'bodyHash' and 'algorithm' fields.",
    };
  }
  const { contentVersion, bodyHash, algorithm } = decodedLock.success;
  if (algorithm !== artifact.envelope.algorithm) {
    return {
      ok: false,
      code: "CONTENT_LOCK_ALGORITHM_MISMATCH",
      message: `The content lock uses '${algorithm}' but the artifact uses '${artifact.envelope.algorithm}'.`,
      expected: algorithm,
      actual: artifact.envelope.algorithm,
    };
  }
  const actualHash = artifact.envelope.bodyHash;
  if (actualHash !== bodyHash) {
    return {
      ok: false,
      code: "CONTENT_LOCK_HASH_MISMATCH",
      message: `Content hash drift: the lock records '${bodyHash}' but the rebuilt artifact has '${actualHash}'. Rebuild and refresh the lock if the content changed deliberately.`,
      expected: bodyHash,
      actual: actualHash,
    };
  }
  if (artifact.contentVersion !== contentVersion) {
    return {
      ok: false,
      code: "CONTENT_LOCK_VERSION_MISMATCH",
      message: `Content version mismatch: the lock records '${contentVersion}' but the reconstructed artifact declares '${artifact.contentVersion}'.`,
      expected: contentVersion,
      actual: artifact.contentVersion,
    };
  }
  return { ok: true };
}

function decodeContentBundle(
  value: Record<string, unknown>,
): { ok: true; bundle: CompiledContentBundle } | { ok: false; message: string } {
  const collector = new DiagnosticCollector();
  const decoded = validateAgainstSchema(
    value,
    ContentBundleSchema,
    "ContentBundle",
    CONTENT_ARTIFACT_FILENAME,
    collector,
  );
  if (decoded === undefined) {
    const first = collector.errors[0]?.message ?? "the bundle does not match its schema";
    return { ok: false, message: first };
  }
  return { ok: true, bundle: decoded };
}

export function buildContentBundleArtifact(
  input: CompilerInput,
  signal: AbortSignal,
  collector: DiagnosticCollector,
): ContentBundleArtifact | undefined {
  const output = new Compiler().compile(input, signal, collector);
  if (!output || collector.hasErrors) return undefined;

  const bundle = validateAgainstSchema(
    output.bundle,
    ContentBundleSchema,
    "ContentBundle",
    CONTENT_ARTIFACT_FILENAME,
    collector,
  );
  if (bundle === undefined) return undefined;

  const envelope = createEnvelope(
    CONTENT_BUNDLE_ARTIFACT_KIND,
    CONTENT_BUNDLE_COMPATIBILITY_VERSION,
    bundle,
  );
  const manifest: ContentBundleManifest = {
    manifestVersion: CONTENT_BUNDLE_MANIFEST_VERSION,
    doNotEdit: BUNDLE_GENERATED_BY,
    contentVersion: output.contentVersion,
    artifactKind: envelope.artifactKind,
    compatibilityVersion: envelope.compatibilityVersion,
    algorithm: envelope.algorithm,
    bodyHash: envelope.bodyHash,
    bodyLength: envelope.bodyLength,
  };
  return {
    bundle,
    envelope,
    manifest,
    contentVersion: output.contentVersion,
    artifactJson: canonicalSerialize(bundle),
    manifestJson: canonicalSerialize(manifest),
  };
}

export function writeContentBundleArtifact(
  outDir: string,
  artifact: ContentBundleArtifact,
): {
  artifactPath: string;
  manifestPath: string;
} {
  mkdirSync(outDir, { recursive: true });
  const artifactPath = resolve(outDir, CONTENT_ARTIFACT_FILENAME);
  const manifestPath = resolve(outDir, CONTENT_MANIFEST_FILENAME);
  const tempArtifact = artifactPath + ".tmp";
  const tempManifest = manifestPath + ".tmp";
  try {
    writeFileSync(tempArtifact, artifact.artifactJson, "utf8");
    writeFileSync(tempManifest, artifact.manifestJson, "utf8");
    renameSync(tempManifest, manifestPath);
    renameSync(tempArtifact, artifactPath);
  } finally {
    rmSync(tempArtifact, { force: true });
    rmSync(tempManifest, { force: true });
  }
  return { artifactPath, manifestPath };
}

export function verifyContentBundleArtifact(
  bundleValue: unknown,
  manifestValue: unknown,
): ContentBundleVerification {
  const decodedManifest = decodeManifest(manifestValue);
  if (!Result.isSuccess(decodedManifest)) {
    return {
      ok: false,
      code: "CONTENT_MANIFEST_INVALID",
      message: "The content manifest is missing required fields or has an unsupported format.",
    };
  }
  const manifest: ContentBundleManifest = decodedManifest.success;
  if (manifest.doNotEdit !== BUNDLE_GENERATED_BY) {
    return {
      ok: false,
      code: "CONTENT_MANIFEST_MARKER_MISMATCH",
      message: "The content manifest is not a generated artifact (do-not-edit marker mismatch).",
    };
  }
  if (manifest.artifactKind !== CONTENT_BUNDLE_ARTIFACT_KIND) {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_KIND_MISMATCH",
      message: `Expected a '${CONTENT_BUNDLE_ARTIFACT_KIND}' artifact but the manifest declares '${manifest.artifactKind}'.`,
    };
  }
  if (manifest.compatibilityVersion !== CONTENT_BUNDLE_COMPATIBILITY_VERSION) {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_VERSION_MISMATCH",
      message: `Expected content-bundle compatibility version '${CONTENT_BUNDLE_COMPATIBILITY_VERSION}' but the manifest declares '${manifest.compatibilityVersion}'.`,
    };
  }
  if (manifest.algorithm !== "sha256") {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_ALGORITHM_UNSUPPORTED",
      message: `Unsupported content hash algorithm '${manifest.algorithm}'.`,
    };
  }
  if (!Predicate.isObject(bundleValue)) {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_INVALID",
      message: "The content artifact is not a JSON object.",
    };
  }
  if (bundleValue.generatedBy !== BUNDLE_GENERATED_BY) {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_MARKER_MISMATCH",
      message: "The content artifact is not a generated bundle (do-not-edit marker mismatch).",
    };
  }
  const embeddedManifest = bundleValue.manifest;
  const embeddedVersion = Predicate.isObject(embeddedManifest)
    ? embeddedManifest.version
    : undefined;
  if (typeof embeddedVersion === "string" && embeddedVersion !== manifest.contentVersion) {
    return {
      ok: false,
      code: "CONTENT_VERSION_MISMATCH",
      message: `The content manifest declares version '${manifest.contentVersion}' but the artifact bundle declares '${embeddedVersion}'.`,
    };
  }
  if (
    !verifyEnvelope(
      {
        algorithm: manifest.algorithm,
        artifactKind: manifest.artifactKind,
        compatibilityVersion: manifest.compatibilityVersion,
        bodyHash: manifest.bodyHash,
        bodyLength: manifest.bodyLength,
      },
      bundleValue,
    )
  ) {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_HASH_MISMATCH",
      message: "The content artifact does not match its recorded SHA-256 body hash.",
    };
  }
  const decoded = decodeContentBundle(bundleValue);
  if (!decoded.ok) {
    return {
      ok: false,
      code: "CONTENT_ARTIFACT_SCHEMA_MISMATCH",
      message: `The content artifact matches its recorded hash but does not match its content schema: ${decoded.message}. Rebuild with \`pnpm content:build\`.`,
    };
  }
  return { ok: true, bundle: decoded.bundle, manifest };
}
