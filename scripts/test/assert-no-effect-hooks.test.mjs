import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXTERNAL_SYNC_MODULE,
  evaluateEffectHooks,
  findEffectHooks,
  isGuarded,
  measureEffectHooks,
  runSelfTest,
} from "../assert-no-effect-hooks.mjs";

const count = (source, file = "a.tsx") => findEffectHooks(file, source).length;
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

void test("self-test fixtures pass", () => {
  assert.equal(runSelfTest().ok, true);
});

void test("counts the import binding and every reference", () => {
  assert.equal(count('import { useEffect } from "react"; useEffect(a, []); useEffect(b, []);'), 3);
});

void test("flags every banned hook", () => {
  for (const hook of ["useEffect", "useLayoutEffect", "useInsertionEffect"]) {
    assert.equal(count(`import * as R from "react"; R.${hook}(f);`), 1);
  }
});

void test("reports the line and hook", () => {
  const [finding] = findEffectHooks("a.tsx", 'import * as R from "react";\nR.useEffect(f);\n');
  assert.equal(finding.line, 2);
  assert.equal(finding.hook, "useEffect");
});

void test("fails closed on a parse error", () => {
  assert.throws(() => findEffectHooks("a.tsx", "useEffect("), /failing closed/u);
});

void test("any banned use in a guarded file is a violation", () => {
  const violations = evaluateEffectHooks({ "apps/a.ts": 1 });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /apps\/a\.ts: 1 effect hook use/u);
});

void test("a tree without banned uses has no violations", () => {
  assert.deepEqual(evaluateEffectHooks({}), []);
});

void test("the ratchet baseline is retired", () => {
  assert.equal(existsSync(`${repoRoot}scripts/effect-hooks.baseline.json`), false);
});

void test("only the single external-sync module path is exempt from the guard", () => {
  assert.equal(isGuarded(EXTERNAL_SYNC_MODULE), false);
  assert.equal(isGuarded(EXTERNAL_SYNC_MODULE.replace("shell/", "lib/")), true);
  assert.equal(isGuarded(`${EXTERNAL_SYNC_MODULE}x`), true);
  assert.equal(isGuarded("apps/desktop/src/renderer/shell/other.ts"), true);
});

void test("the real tree has no banned effect hook outside the exemptions", () => {
  assert.deepEqual(measureEffectHooks(repoRoot), {});
});
