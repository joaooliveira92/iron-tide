// Tests for scripts/verify-package-dependencies.mjs — the workspace dependency
// policy at the manifest layer.
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkManifest } from "../verify-package-dependencies.mjs";

const reasons = (pkg) =>
  checkManifest("packages/x/package.json", pkg).map((violation) => violation.reason);

void test("accepts conforming specifiers", () => {
  assert.deepEqual(
    reasons({
      dependencies: { "@bluewave/contracts": "workspace:*", effect: "workspace:*" },
      devDependencies: { "oxc-parser": "0.153.0", zod: "^4.6.5" },
    }),
    [],
  );
});

void test("rejects floating specifiers", () => {
  for (const specifier of ["*", "latest", "next", "x", ""]) {
    assert.deepEqual(reasons({ dependencies: { foo: specifier } }), ["floating specifier"]);
  }
});

void test("requires effect to be a workspace link (single-copy)", () => {
  assert.deepEqual(reasons({ dependencies: { effect: "4.0.2" } }), [
    "effect must be a workspace link (single-copy invariant)",
  ]);
  assert.deepEqual(reasons({ devDependencies: { "@effect/vitest": "^4.0.2" } }), [
    "effect must be a workspace link (single-copy invariant)",
  ]);
});

void test("requires internal packages to use the workspace: protocol", () => {
  assert.deepEqual(reasons({ dependencies: { "@bluewave/contracts": "^1.0.0" } }), [
    "internal package must use the workspace: protocol",
  ]);
});

void test("requires the toolchain to be pinned exact", () => {
  for (const name of ["@effect/tsgo", "oxlint", "oxlint-tsgolint", "typescript", "oxc-parser"]) {
    assert.deepEqual(reasons({ devDependencies: { [name]: "^1.0.0" } }), [
      "toolchain dependency must be pinned exact",
    ]);
  }
});
