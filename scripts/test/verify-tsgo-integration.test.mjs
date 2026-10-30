// Tests for scripts/verify-tsgo-integration.mjs — the toolchain-matrix check and
// the `.original` backup discovery that prove the install-time tsgo patch ran
//.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkToolchainVersions,
  findOriginalFiles,
  resolveInstalledPlatformPackage,
} from "../verify-tsgo-integration.mjs";

const VERSIONS = {
  "@effect/tsgo": "0.54.1",
  typescript: "7.0.2",
  oxlint: "1.89.0",
  "oxlint-tsgolint": "7.0.2004",
};

void test("pins matching the installed toolchain pass", () => {
  assert.deepEqual(checkToolchainVersions({ installed: VERSIONS, pinned: { ...VERSIONS } }), []);
});

void test("a drifted pin is reported", () => {
  const problems = checkToolchainVersions({
    installed: VERSIONS,
    pinned: { ...VERSIONS, typescript: "7.0.3" },
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /typescript.*7\.0\.3.*7\.0\.2/u);
});

void test("a missing pin is reported", () => {
  const { oxlint: _omitted, ...pinned } = VERSIONS;
  const problems = checkToolchainVersions({ installed: VERSIONS, pinned });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /oxlint.*undefined.*1\.89\.0/u);
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
