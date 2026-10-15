import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONTENT_ARTIFACT_FILENAME,
  CONTENT_MANIFEST_FILENAME,
  verifyContentBundleArtifact,
  type ContentBundle,
  type ContentBundleManifest,
} from "@bluewave/content-compiler";

import { resolveGeneratedContentDir } from "./contentPack.js";

/** Stable, actionable failure codes for the runtime content trust boundary. */
export type ContentArtifactErrorCode =
  | "CONTENT_ARTIFACT_MISSING"
  | "CONTENT_ARTIFACT_UNREADABLE"
  | "CONTENT_ARTIFACT_INVALID";

export class ContentArtifactError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "ContentArtifactError";
  /** `_tag`-based narrowing without `instanceof`. */
  static is(value: unknown): value is ContentArtifactError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { readonly _tag?: unknown })._tag === "ContentArtifactError"
    );
  }
  readonly code: ContentArtifactErrorCode;
  /** The specific verification failure code, when `code` is `CONTENT_ARTIFACT_INVALID`. */
  readonly reason?: string;

  constructor(code: ContentArtifactErrorCode, message: string, reason?: string) {
    super(message);
    this.name = "ContentArtifactError";
    this.code = code;
    this.reason = reason;
  }
}

export interface LoadedContentArtifact {
  readonly bundle: ContentBundle;
  readonly manifest: ContentBundleManifest;
}

/**
 * Reads and verifies the compiled content artifact (ADR-0122) from a generated
 * directory. The main process runs on exactly the content the compiler
 * validated: the manifest's recorded kind/version/marker and SHA-256 body hash
 * must all match the artifact, otherwise this throws `ContentArtifactError` and
 * the app fails closed rather than running unvalidated content.
 */
export function readContentArtifact(dir: string): LoadedContentArtifact {
  const artifactPath = join(dir, CONTENT_ARTIFACT_FILENAME);
  const manifestPath = join(dir, CONTENT_MANIFEST_FILENAME);

  if (!existsSync(artifactPath) || !existsSync(manifestPath)) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_MISSING",
      `No compiled content artifact at ${dir}. Run \`pnpm content:build\` before starting the app.`,
    );
  }

  let bundleValue: unknown;
  let manifestValue: unknown;
  try {
    bundleValue = JSON.parse(readFileSync(artifactPath, "utf8"));
    manifestValue = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_UNREADABLE",
      `The compiled content artifact at ${dir} is unreadable: ${message}`,
    );
  }

  const verification = verifyContentBundleArtifact(bundleValue, manifestValue);
  if (!verification.ok) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `The compiled content artifact at ${dir} failed verification: ${verification.message}`,
      verification.code,
    );
  }

  return { bundle: verification.bundle, manifest: verification.manifest };
}

/** Reads and verifies the shipped production artifact from its canonical location. */
export function loadContentArtifact(): LoadedContentArtifact {
  return readContentArtifact(resolveGeneratedContentDir());
}
