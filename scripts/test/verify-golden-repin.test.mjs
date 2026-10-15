import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectProblems,
  commitNeedsRepin,
  isAuthoritativeSource,
  isReferenceRunExempt,
} from "../verify-golden-repin.mjs";

void test("recognises authoritative package source", () => {
  assert.equal(isAuthoritativeSource("packages/combat/src/gunnery/accuracy.ts"), true);
  assert.equal(isAuthoritativeSource("packages/campaign/src/state.tsx"), true);
  assert.equal(isAuthoritativeSource("packages/phase-engine/src/month.ts"), true);
});

void test("ignores tests, other packages, and non-source", () => {
  assert.equal(isAuthoritativeSource("packages/combat/test/gunnery/accuracy.test.ts"), false);
  assert.equal(isAuthoritativeSource("packages/desktop/src/main/index.ts"), false);
  assert.equal(isAuthoritativeSource("docs/rules/gunnery.md"), false);
  assert.equal(isAuthoritativeSource("golden/hashes.json"), false);
});

void test("authored content is exempt: the reference run uses an in-code fixture", () => {
  assert.equal(isReferenceRunExempt("content/production/1880/pack.json"), true);
  assert.equal(isAuthoritativeSource("content/production/1880/pack.json"), false);
  assert.equal(
    isAuthoritativeSource("content/production/1880/ship-building/naval-profiles/uk.yaml"),
    false,
  );
});

void test("reference-inert dock plumbing is exempt but sibling ship-design source is not", () => {
  assert.equal(isReferenceRunExempt("packages/ship-design/src/dock.ts"), true);
  assert.equal(isAuthoritativeSource("packages/ship-design/src/dock.ts"), false);
  assert.equal(isAuthoritativeSource("packages/campaign/src/state.ts"), false);
  assert.equal(isAuthoritativeSource("packages/content-schema/src/naval-profile.ts"), false);
  // A different ship-design module is still gated.
  assert.equal(isAuthoritativeSource("packages/ship-design/src/construction.ts"), true);
  assert.equal(isAuthoritativeSource("packages/phase-engine/src/month.ts"), true);
});

void test("a docs-only commit never needs a re-pin", () => {
  assert.equal(commitNeedsRepin(["docs/adr/ADR-0001.md"], "docs: add ADR"), false);
});

void test("a content-only commit never needs a re-pin", () => {
  assert.equal(
    commitNeedsRepin(
      ["content/production/1880/ship-building/naval-profiles/uk.yaml"],
      "content(shipbuilding): author dock record",
    ),
    false,
  );
});

void test("authoritative source without golden needs a re-pin", () => {
  assert.equal(
    commitNeedsRepin(["packages/combat/src/gunnery/accuracy.ts"], "fix(combat): tune accuracy"),
    true,
  );
});

void test("re-pinning the golden in the same commit satisfies the guard", () => {
  assert.equal(
    commitNeedsRepin(
      ["packages/combat/src/gunnery/accuracy.ts", "golden/hashes.json"],
      "fix(combat): tune accuracy",
    ),
    false,
  );
});

void test("the not-needed trailer records a deliberate no-output change", () => {
  const message =
    "refactor(phase-engine): type the pipeline throws\n\nNo authoritative output changes.\nGolden-Repin: not-needed\n";
  assert.equal(commitNeedsRepin(["packages/phase-engine/src/errors.ts"], message), false);
});

void test("collectProblems reports only offending commits", () => {
  const commits = [
    {
      hash: "a".repeat(40),
      subject: "fix: ok",
      message: "fix: ok\n",
      paths: ["packages/combat/src/x.ts", "golden/hashes.json"],
    },
    {
      hash: "b".repeat(40),
      subject: "fix: drift",
      message: "fix: drift\n",
      paths: ["packages/phase-engine/src/y.ts"],
    },
  ];
  const problems = collectProblems(commits);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].hash, "b".repeat(40));
  assert.deepEqual(problems[0].files, ["packages/phase-engine/src/y.ts"]);
});
