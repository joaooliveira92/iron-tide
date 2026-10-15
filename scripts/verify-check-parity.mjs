#!/usr/bin/env node
// CI <-> `pnpm check` parity gate (ADR-0107, ADR-0140). Every step `pnpm check`
// runs must also be invoked by some `.github/workflows/*.yml`, or be listed in
// the inline ALLOWLIST below with the workflow and raw command that covers it.
//
// The chain and CI have drifted before: `pnpm check` grew `lint:effect` while no
// workflow ran it, so the Effect gate (`duplicatePackage` as an error plus the
// determinism/outdatedApi rules) was unenforced on dev/main. This gate closes
// that class of drift: add a step to `check` without a CI invocation and the
// preflight set fails, naming the uncovered step.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const WORKFLOWS_DIR = resolve(ROOT, ".github/workflows");

// Steps `pnpm check` runs whose CI coverage is a raw command rather than a
// literal `pnpm <step>`. Each documents the workflow and the exact command that
// stands in for it. Keep this list as small as possible: prefer making a
// workflow run the real `pnpm <step>`.
export const ALLOWLIST = {
  "check:golden":
    "determinism.yml runs `node scripts/verify-golden-hashes.cjs` (Verify golden hashes)",
  "check:determinism":
    "determinism.yml runs `node packages/cross-process-test/dist/run-child.js` (Cross-process determinism)",
};

/**
 * Parse the root `check` script into its ordered `pnpm <step>` commands. Any
 * segment that is not exactly `pnpm <step>` is a fail-closed parse error: the
 * gate must not silently ignore a check step it does not understand.
 * @param {string} checkScript
 * @returns {string[]}
 */
export function parseCheckSteps(checkScript) {
  const steps = [];
  for (const segment of checkScript.split("&&")) {
    const trimmed = segment.trim();
    if (trimmed === "") continue;
    const match = /^pnpm\s+(\S+)$/u.exec(trimmed);
    if (match === null) {
      throw new Error(`check-parity: \`pnpm check\` has an unparseable step "${trimmed}"`);
    }
    steps.push(match[1]);
  }
  return steps;
}

/**
 * Does a workflow file invoke `pnpm <step>`? Matches the `pnpm` and step as
 * whole whitespace-separated tokens on the same line, so `pnpm lint:effect`,
 * `pnpm --filter @bluewave/desktop test:e2e`, and `… pnpm lint && pnpm format`
 * all count while `check:golden` is not falsely covered by `check:golden-repin`.
 * Comment lines are ignored so a documented example is not mistaken for a run.
 * @param {string} step
 * @param {string} workflowText
 * @returns {boolean}
 */
export function isStepInvoked(step, workflowText) {
  for (const rawLine of workflowText.split("\n")) {
    if (rawLine.trim().startsWith("#")) continue;
    const tokens = rawLine.trim().split(/\s+/u);
    if (tokens.includes("pnpm") && tokens.includes(step)) return true;
  }
  return false;
}

/**
 * The steps not covered by any workflow text and not allowlisted.
 * @param {{ steps: string[], workflowTexts: string[], allowlist?: Record<string, string> }} input
 * @returns {string[]}
 */
export function findUncoveredSteps({ steps, workflowTexts, allowlist = ALLOWLIST }) {
  return steps.filter((step) => {
    if (Object.hasOwn(allowlist, step)) return false;
    return !workflowTexts.some((text) => isStepInvoked(step, text));
  });
}

/** Read every workflow file's text, in stable filename order. */
function readWorkflowTexts() {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort()
    .map((name) => readFileSync(resolve(WORKFLOWS_DIR, name), "utf8"));
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const { scripts } = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    if (typeof scripts?.check !== "string") {
      throw new Error("root package.json has no `check` script");
    }
    const steps = parseCheckSteps(scripts.check);
    const uncovered = findUncoveredSteps({ steps, workflowTexts: readWorkflowTexts() });
    if (uncovered.length > 0) {
      for (const step of uncovered) {
        console.error(
          `check-parity: \`pnpm ${step}\` is in \`pnpm check\` but no workflow invokes it ` +
            `and it is not allowlisted (add a CI step or an ALLOWLIST entry with the covering command)`,
        );
      }
      process.exit(1);
    }
    console.log(`check-parity: ok (${steps.length} check steps, all covered by CI)`);
  } catch (error) {
    console.error(`check-parity: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
