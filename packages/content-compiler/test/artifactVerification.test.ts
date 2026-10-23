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
          "The content lock must carry string 'contentVersion', 'bodyHash' and 'algorithm' fields.",
      });
    },
  );

  it("tolerates extra lock keys", () => {
    expect(verifyContentLock(artifact, { ...lock, surprise: true })).toEqual({ ok: true });
  });
});
