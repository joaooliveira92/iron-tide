// Tests for scripts/verify-tsgo-integration.mjs — the toolchain-matrix check and
// the `.original` backup discovery that prove the install-time tsgo patch ran
// (ADR-0139).
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  TSGO_MATRIX,
  checkToolchainVersions,
  findOriginalFiles,
  resolveInstalledPlatformPackage,
} from "../verify-tsgo-integration.mjs";

const MATRIX = {
  "0.51.1": { typescript: "7.0.2", oxlint: "1.87.0", "oxlint-tsgolint": "7.0.2003" },
};

void test("a pin set matching the @effect/tsgo matrix passes", () => {
  assert.deepEqual(
    checkToolchainVersions({
      tsgoVersion: "0.51.1",
      matrix: MATRIX,
      pinned: { typescript: "7.0.2", oxlint: "1.87.0", "oxlint-tsgolint": "7.0.2003" },
    }),
    [],
  );
});

void test("a drifted pin is reported", () => {
  const problems = checkToolchainVersions({
    tsgoVersion: "0.51.1",
    matrix: MATRIX,
    pinned: { typescript: "7.0.3", oxlint: "1.87.0", "oxlint-tsgolint": "7.0.2003" },
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /typescript.*7\.0\.3.*7\.0\.2/u);
});

void test("an unknown @effect/tsgo version fails closed", () => {
  const problems = checkToolchainVersions({ tsgoVersion: "9.9.9", matrix: MATRIX, pinned: {} });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /9\.9\.9.*not in TSGO_MATRIX/u);
});

void test("the shipped matrix keeps @effect/tsgo 0.51.1's supported pins", () => {
  assert.deepEqual(TSGO_MATRIX["0.51.1"], MATRIX["0.51.1"]);
});

void test("finds `.original` backups at any depth and reports none when absent", () => {
  const root = mkdtempSync(join(tmpdir(), "tsgo-integration-"));
  try {
    mkdirSync(join(root, "lib"));
    writeFileSync(join(root, "tsgolint.original"), "");
    writeFileSync(join(root, "lib", "tsc.original"), "");
    writeFileSync(join(root, "tsgolint"), "");
    assert.deepEqual(findOriginalFiles(root), [
      join(root, "lib", "tsc.original"),
      join(root, "tsgolint.original"),
    ]);
    assert.deepEqual(findOriginalFiles(join(root, "missing")), []);
    assert.deepEqual(findOriginalFiles(join(root, "lib")).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("a parent with no platform optionalDependencies resolves nothing", () => {
  const root = mkdtempSync(join(tmpdir(), "tsgo-parent-"));
  try {
    const packageJson = join(root, "package.json");
    writeFileSync(packageJson, JSON.stringify({ name: "fixture", version: "1.0.0" }));
    assert.equal(resolveInstalledPlatformPackage(packageJson), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
