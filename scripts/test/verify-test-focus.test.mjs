// test-focus-scan-ignore-file: this suite's fixtures necessarily contain the
// focus/skip tokens the gate scans for, so it opts out of its own scan.
import assert from "node:assert/strict";
import { test } from "node:test";

import { collectProblems, isTestFile, scanTestSource } from "../verify-test-focus.mjs";

void test("isTestFile admits authored test files and excludes support trees", () => {
  assert.equal(isTestFile("packages/combat/test/gunnery/accuracy.test.ts"), true);
  assert.equal(isTestFile("apps/desktop/src/renderer/foo.test.tsx"), true);
  assert.equal(isTestFile("scripts/test/run-gates.test.mjs"), true);
  assert.equal(isTestFile("packages/combat/src/gunnery/accuracy.ts"), false);
  assert.equal(isTestFile("vendor/effect/dist/foo.test.js"), false);
  assert.equal(isTestFile("apps/desktop/dist/renderer/foo.test.jsx"), false);
});

void test("flags a focused test", () => {
  const scan = scanTestSource("it.only('x', () => {});\n");
  assert.equal(scan.focuses.length, 1);
  assert.equal(scan.focuses[0].line, 1);
});

void test("flags a bare skip as unexplained", () => {
  const scan = scanTestSource("describe.skip('x', () => {});\n");
  assert.equal(scan.skips.length, 1);
  assert.equal(scan.skips[0].allowed, false);
});

void test("admits a skip explained on the same line", () => {
  const scan = scanTestSource(
    "describe.skip('x', () => {}); // test-focus-allow-skip: needs GPU\n",
  );
  assert.equal(scan.skips[0].allowed, true);
  assert.deepEqual(
    collectProblems("a.test.ts", "describe.skip('x'); // test-focus-allow-skip: needs GPU"),
    [],
  );
});

void test("admits a skip explained on the preceding line", () => {
  const text =
    "// test-focus-allow-skip: Electron optional\nconst d = hasElectron ? describe : describe.skip;\n";
  const scan = scanTestSource(text);
  assert.equal(scan.skips.length, 1);
  assert.equal(scan.skips[0].allowed, true);
});

void test("ignores tokens in a line comment", () => {
  assert.equal(scanTestSource("// it.only('x')\n").focuses.length, 0);
  assert.equal(scanTestSource("// describe.skip('x')\n").skips.length, 0);
});

void test("a file-level ignore opts the whole file out", () => {
  const text = "// test-focus-scan-ignore-file: self-test\nit.only('x');\n";
  assert.deepEqual(collectProblems("a.test.ts", text), []);
});

void test("collectProblems reports file:line for both findings", () => {
  const problems = collectProblems("a.test.ts", "it.only('x');\ndescribe.skip('y');\n");
  assert.equal(problems.length, 2);
  assert.match(problems[0], /a\.test\.ts:1 focused test/);
  assert.match(problems[1], /a\.test\.ts:2 unexplained skip/);
});
