// Tests for scripts/verify-check-parity.mjs — the check<->CI parity boundary:
// parsing the `check` chain, the whole-token invocation matcher, and the
// allowlist. The regression it guards is `lint:effect` living in `check` with no
// workflow running it.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWLIST,
  findUncoveredSteps,
  isStepInvoked,
  parseCheckSteps,
} from "../verify-check-parity.mjs";

const CHECK =
  "pnpm preflight && pnpm format && pnpm lint && pnpm lint:effect && pnpm build && pnpm test:e2e";

void test("parses the check chain into ordered steps", () => {
  assert.deepEqual(parseCheckSteps(CHECK), [
    "preflight",
    "format",
    "lint",
    "lint:effect",
    "build",
    "test:e2e",
  ]);
});

void test("fails closed on a step that is not `pnpm <script>`", () => {
  assert.throws(() => parseCheckSteps("pnpm lint && turbo run build"), /unparseable step/u);
});

void test("matches a literal `pnpm <step>`", () => {
  assert.equal(isStepInvoked("lint:effect", "      - run: pnpm lint:effect\n"), true);
});

void test("matches a filtered invocation on the same line", () => {
  assert.equal(
    isStepInvoked("test:e2e", "        run: pnpm --filter @bluewave/desktop test:e2e\n"),
    true,
  );
});

void test("ignores comment lines", () => {
  assert.equal(isStepInvoked("lint:effect", "# run: pnpm lint:effect\n"), false);
});

void test("matches whole tokens only, never a prefix", () => {
  assert.equal(isStepInvoked("check:golden", "      - run: pnpm check:golden-repin\n"), false);
  assert.equal(isStepInvoked("lint", "      - run: pnpm lint:effect\n"), false);
});

void test("allowlisted steps are covered without a workflow invocation", () => {
  const allowlist = { "check:golden": "determinism.yml raw command" };
  assert.deepEqual(
    findUncoveredSteps({ steps: ["check:golden"], workflowTexts: [""], allowlist }),
    [],
  );
});

void test("names every uncovered step, in chain order", () => {
  const workflow = "      - run: pnpm lint\n      - run: pnpm format\n";
  const uncovered = findUncoveredSteps({
    steps: ["lint", "format", "lint:effect", "build"],
    workflowTexts: [workflow],
    allowlist: {},
  });
  assert.deepEqual(uncovered, ["lint:effect", "build"]);
});

void test("the allowlist is seeded with the check steps covered by raw commands", () => {
  assert.deepEqual(Object.keys(ALLOWLIST).sort(), [
    "check:determinism",
    "check:explanation-coverage",
    "check:golden",
    "check:reachability-ledger",
  ]);
  for (const coverage of Object.values(ALLOWLIST)) {
    assert.match(coverage, /(?:\.yml|preflight)/u);
  }
});
