import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { compareHashes } = createRequire(import.meta.url)("../verify-golden-hashes.cjs");

const golden = { a: "1", b: "2" };

void test("identical hash sets produce no problems", () => {
  assert.deepEqual(compareHashes({ a: "1", b: "2" }, golden), []);
});

void test("a differing hash is reported with both values", () => {
  const problems = compareHashes({ a: "1", b: "x" }, golden);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /MISMATCH: b actual=x golden=2/u);
});

void test("a key missing from the observed output is reported", () => {
  const problems = compareHashes({ a: "1" }, golden);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /MISSING: b/u);
});

void test("a key absent from the golden file is reported", () => {
  const problems = compareHashes({ a: "1", b: "2", c: "3" }, golden);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /EXTRA: c/u);
});
