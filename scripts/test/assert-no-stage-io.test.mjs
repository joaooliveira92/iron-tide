// Tests for scripts/assert-no-stage-io.mjs — the ambient-I/O gate over the
// compiler stage directory (ADR-0004). Covers the rejected I/O modules (import,
// dynamic import, require), the permitted ones, and the fail-closed parse path.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { STAGE_ROOT, findStageIo, scanStageIo } from "../assert-no-stage-io.mjs";

const count = (text) => findStageIo("a.ts", text).length;

void test("rejects node:fs and node:child_process imports", () => {
  assert.equal(count('import { readFileSync } from "node:fs";'), 1);
  assert.equal(count('import { readFile } from "node:fs/promises";'), 1);
  assert.equal(count('import { exec } from "node:child_process";'), 1);
});

void test("rejects dynamic import and require of I/O modules", () => {
  assert.equal(count('const fs = await import("node:fs");'), 1);
  assert.equal(count('const fs = require("node:fs");'), 1);
});

void test("permits node:path and local imports", () => {
  assert.equal(count('import { resolve } from "node:path";'), 0);
  assert.equal(count('import { readFileSync } from "./readFileSync.js";'), 0);
});

void test("fails closed on a parse error", () => {
  assert.throws(() => findStageIo("a.ts", "import {"), /failing closed/u);
});

void test("guards the stage directory and the real tree is clean", () => {
  assert.equal(STAGE_ROOT, "packages/content-compiler/src/stages");
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  assert.deepEqual(scanStageIo(repoRoot), []);
});
