import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";

import {
  buildContentBundleArtifact,
  verifyContentBundleArtifact,
  verifyContentLock,
} from "../src/index.js";
import { baseInput, createFixture } from "./partModelFixture.js";

function builtArtifact() {
  const fixture = createFixture();
  try {
    const collector = new DiagnosticCollector();
    const artifact = buildContentBundleArtifact(
      baseInput(fixture),
      new AbortController().signal,
      collector,
    );
    expect(collector.errors).toEqual([]);
    return artifact!;
  } finally {
    fixture.cleanup();
  }
}

const artifact = builtArtifact();
const bundle: unknown = JSON.parse(artifact.artifactJson);
const manifest = JSON.parse(artifact.manifestJson) as Record<string, unknown>;

describe("content manifest verification", () => {
  it("verifies a generated artifact against its manifest", () => {
    const verified = verifyContentBundleArtifact(bundle, manifest);
    expect(verified.ok).toBe(true);
  });

  it.each([null, [], "manifest", 3])("rejects a manifest that is %j", (value) => {
    expect(verifyContentBundleArtifact(bundle, value)).toMatchObject({
      ok: false,
      code: "CONTENT_MANIFEST_INVALID",
    });
  });

  it.each([
    ["manifestVersion", 2],
    ["doNotEdit", 1],
    ["contentVersion", undefined],
    ["artifactKind", null],
    ["compatibilityVersion", 1],
    ["algorithm", [] as unknown[]],
    ["bodyHash", {}],
    ["bodyLength", "12"],
    ["bodyLength", Number.NaN],
    ["bodyLength", Number.POSITIVE_INFINITY],
  ])("rejects a manifest whose %s is %j", (field, value) => {
    expect(verifyContentBundleArtifact(bundle, { ...manifest, [field]: value })).toMatchObject({
      ok: false,
      code: "CONTENT_MANIFEST_INVALID",
    });
  });

  it("tolerates extra manifest keys without copying them into the verified manifest", () => {
    const verified = verifyContentBundleArtifact(bundle, { ...manifest, surprise: true });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.manifest).toEqual(manifest);
  });
});

describe("content lock verification", () => {
  const lock = {
    contentVersion: artifact.contentVersion,
    bodyHash: artifact.envelope.bodyHash,
    algorithm: artifact.envelope.algorithm,
  };

  it("accepts a matching lock", () => {
    expect(verifyContentLock(artifact, lock)).toEqual({ ok: true });
  });

  it.each([null, [], "lock", 3])("rejects a lock that is %j", (value) => {
    expect(verifyContentLock(artifact, value)).toEqual({
      ok: false,
      code: "CONTENT_LOCK_INVALID",
      message: "The content lock is not an object.",
    });
  });

  it.each(["contentVersion", "bodyHash", "algorithm"])(
    "rejects a lock whose %s is not a string",
    (field) => {
      expect(verifyContentLock(artifact, { ...lock, [field]: 1 })).toEqual({
        ok: false,
        code: "CONTENT_LOCK_INVALID",
        message:
          "The content lock must carry string 'contentVersion' and 'algorithm' fields and, if present, a string 'bodyHash'.",
      });
    },
  );

  it("tolerates extra lock keys", () => {
    expect(verifyContentLock(artifact, { ...lock, surprise: true })).toEqual({ ok: true });
  });

  const hashless = { contentVersion: lock.contentVersion, algorithm: lock.algorithm };

  it("accepts a lock with no body hash on dev and ignores a stale one", () => {
    expect(verifyContentLock(artifact, hashless)).toEqual({ ok: true });
    expect(verifyContentLock(artifact, { ...lock, bodyHash: "0".repeat(64) })).toEqual({
      ok: true,
    });
  });

  it("still checks the version and algorithm on dev", () => {
    expect(verifyContentLock(artifact, { ...hashless, contentVersion: "9.9.9" })).toMatchObject({
      ok: false,
      code: "CONTENT_LOCK_VERSION_MISMATCH",
    });
    expect(verifyContentLock(artifact, { ...hashless, algorithm: "md5" })).toMatchObject({
      ok: false,
      code: "CONTENT_LOCK_ALGORITHM_MISMATCH",
    });
  });

  it("requires a matching body hash for a release", () => {
    expect(verifyContentLock(artifact, lock, "release")).toEqual({ ok: true });
    expect(verifyContentLock(artifact, hashless, "release")).toMatchObject({
      ok: false,
      code: "CONTENT_LOCK_HASH_MISSING",
    });
    expect(
      verifyContentLock(artifact, { ...lock, bodyHash: "0".repeat(64) }, "release"),
    ).toMatchObject({ ok: false, code: "CONTENT_LOCK_HASH_MISMATCH" });
  });
});
