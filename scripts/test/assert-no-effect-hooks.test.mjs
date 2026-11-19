import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

void test("an unlisted file with a use is a violation", () => {
  const result = evaluateEffectHooks({ "a.ts": 1 }, {});
  assert.equal(result.violations.length, 1);
});

void test("a listed file that grew is a violation", () => {
  const result = evaluateEffectHooks({ "a.ts": 3 }, { "a.ts": 2 });
  assert.equal(result.violations.length, 1);
});

void test("a listed file that fell or vanished must tighten the baseline", () => {
  const fell = evaluateEffectHooks({ "a.ts": 1 }, { "a.ts": 2 });
  assert.deepEqual(fell.violations, []);
  assert.equal(fell.tighten.length, 1);
  const gone = evaluateEffectHooks({}, { "a.ts": 2 });
  assert.equal(gone.tighten.length, 1);
});

void test("only the single external-sync module path is exempt from the guard", () => {
  assert.equal(isGuarded(EXTERNAL_SYNC_MODULE), false);
  assert.equal(isGuarded(EXTERNAL_SYNC_MODULE.replace("shell/", "lib/")), true);
  assert.equal(isGuarded(`${EXTERNAL_SYNC_MODULE}x`), true);
  assert.equal(isGuarded("apps/desktop/src/renderer/shell/other.ts"), true);
});

void test("the real tree matches the baseline exactly", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const baseline = JSON.parse(
    readFileSync(`${repoRoot}scripts/effect-hooks.baseline.json`, "utf8"),
  );
  assert.deepEqual(evaluateEffectHooks(measureEffectHooks(repoRoot), baseline), {
    violations: [],
    tighten: [],
  });
});
