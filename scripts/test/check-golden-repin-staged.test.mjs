import assert from "node:assert/strict";
import { test } from "node:test";

import { stagedRepinProblems } from "../check-golden-repin-staged.mjs";

const WORLD_MAP = "packages/campaign-engine/src/world-map.ts";

void test("authoritative source with no golden update or trailer is refused", () => {
  assert.deepEqual(stagedRepinProblems([WORLD_MAP], "feat(map): draw lanes\n"), [WORLD_MAP]);
});

void test("a golden update in the same commit clears it", () => {
  assert.deepEqual(stagedRepinProblems([WORLD_MAP, "golden/hashes.json"], "feat(map): x\n"), []);
});

void test("the not-needed trailer clears it", () => {
  assert.deepEqual(
    stagedRepinProblems([WORLD_MAP], "refactor(map): x\n\nGolden-Repin: not-needed\n"),
    [],
  );
});

void test("exempt and non-authoritative paths never trigger it", () => {
  assert.deepEqual(
    stagedRepinProblems(["content/production/1880/x.yaml", "docs/a.md"], "docs: x\n"),
    [],
  );
});

void test("merge, revert, fixup and squash commits are skipped", () => {
  for (const subject of ["Merge branch 'a' into dev", 'Revert "x"', "fixup! x", "squash! x"]) {
    assert.deepEqual(stagedRepinProblems([WORLD_MAP], `${subject}\n`), []);
  }
});

void test("world-map stays refused: the guard adds no exemption", () => {
  assert.notEqual(stagedRepinProblems([WORLD_MAP], "fix(map): y\n").length, 0);
});
