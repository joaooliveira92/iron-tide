// Tests for scripts/verify-no-torpedo-model-constants.mjs — the no-reader gate's
// detection boundary (ship-part-model ticket 13b, SPM-R26 P4). Covers code hits,
// comment exemptions, string/regex handling, and substring non-matches.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FORBIDDEN_SYMBOLS,
  TORPEDO_FIXTURE_HARNESSES,
  findTorpedoModelConstants,
  findUnscopedTorpedoFixture,
  stripComments,
} from "../verify-no-torpedo-model-constants.mjs";

const count = (text) => findTorpedoModelConstants("packages/combat/src/a.ts", text).length;

void test("flags each retired per-model symbol in code", () => {
  for (const symbol of FORBIDDEN_SYMBOLS) {
    assert.equal(count(`const x = ${symbol};`), 1, symbol);
  }
});

void test("flags a symbol in an import/export statement", () => {
  assert.equal(count("import { torpedoModelById } from './model.js';"), 1);
  assert.equal(count("export { SHIPPED_TORPEDO_MODELS } from './model.js';"), 1);
});

void test("does not flag a symbol in a line comment", () => {
  assert.equal(count("// torpedoModelById lived here"), 0);
});

void test("does not flag a symbol in a block comment", () => {
  assert.equal(count("/*\n * orderedSettings\n */\nconst a = 1;"), 0);
});

void test("does not flag a trailing comment after code", () => {
  assert.equal(count("const a = 1; // compatibleLauncherFamilyIds"), 0);
});

void test("does not treat `//` inside a string as a comment", () => {
  assert.equal(stripComments('const u = "https://x";'), 'const u = "https://x";');
});

void test("does not flag a symbol that is a substring of another identifier", () => {
  assert.equal(count("const x = CompiledTorpedoSpeedSetting;"), 0);
  assert.equal(count("const x = CompiledTorpedoRegistry;"), 0);
});

void test("reports the offending line", () => {
  const findings = findTorpedoModelConstants(
    "packages/combat/src/a.ts",
    "const a = 1;\nconst b = torpedoModelById;\n",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

void test("flags a torpedo sample record in engine source, not in a harness", () => {
  const record = "const t = { partId: 'x', diameterUm: 533_000 };";
  assert.equal(
    findUnscopedTorpedoFixture("packages/combat/src/torpedoes/evil.ts", record).length,
    1,
  );
  for (const harness of TORPEDO_FIXTURE_HARNESSES) {
    assert.equal(findUnscopedTorpedoFixture(harness, record).length, 0, harness);
  }
});

void test("does not flag a lone field annotation as a sample record", () => {
  assert.equal(
    findUnscopedTorpedoFixture(
      "packages/combat/src/torpedoes/engine.ts",
      "interface T { diameterUm: number }",
    ).length,
    0,
  );
});
