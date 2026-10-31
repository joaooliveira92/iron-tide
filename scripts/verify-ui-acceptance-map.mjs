#!/usr/bin/env node
// UI acceptance map gate. Every `reachable` row of `scripts/data/reachability-ledger.json` must be
// driven by at least one default-lane e2e step named `test.step("reachable:<row-id>", ...)` in
// `apps/desktop/e2e/*.spec.ts`. This gate fails when:
//   - a `reachable` row has no step in a default-lane spec;
//   - a `reachable` row is claimed only by a `*.debug.spec.ts` spec (needs the debug build);
//   - a step names an id that is not a `reachable` row (unknown, dormant-by-decision or internal).
// Usage: `node scripts/verify-ui-acceptance-map.mjs`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateLedgerShape } from "./verify-reachability-ledger.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const LEDGER_PATH = "scripts/data/reachability-ledger.json";
const SPEC_DIR = "apps/desktop/e2e";
const STEP_PATTERN = /test\.step\(\s*"reachable:([^"]*)"/gu;

export const isDebugSpec = (path) => /\.debug\.spec\.[cm]?[jt]sx?$/u.test(path);

/**
 * Row ids claimed by `test.step("reachable:<id>", ...)` calls, in source order. Whole-line `//`
 * comments are ignored so a disabled step does not count.
 * @param {string} source
 * @returns {string[]}
 */
export function extractStepIds(source) {
  const live = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  return [...live.matchAll(STEP_PATTERN)].map((match) => match[1]);
}

/**
 * @param {{ ledger: any, specs: Array<{ path: string, text: string }> }} input
 * @returns {{ ok: boolean, problems: string[], mapped: number }}
 */
export function evaluateMap({ ledger, specs }) {
  const problems = validateLedgerShape(ledger);
  if (problems.length > 0) return { ok: false, problems, mapped: 0 };

  const statusById = new Map(ledger.capabilities.map((row) => [row.id, row.status]));
  const defaultClaims = new Map();
  const debugClaims = new Map();
  for (const { path, text } of specs) {
    const claims = isDebugSpec(path) ? debugClaims : defaultClaims;
    for (const id of extractStepIds(text)) claims.set(id, [...(claims.get(id) ?? []), path]);
  }

  for (const [id, status] of statusById) {
    if (status !== "reachable" || defaultClaims.has(id)) continue;
    problems.push(
      debugClaims.has(id)
        ? `"${id}": reachable row is claimed only by debug spec ${debugClaims.get(id).join(", ")}, which needs the debug build`
        : `"${id}": reachable row has no e2e step; add test.step("reachable:${id}", ...) to a default-lane spec`,
    );
  }

  /**
   * @param {Map<string, string[]>} claims
   * @param {string} label
   */
  const reportNonReachable = (claims, label) => {
    for (const [id, paths] of claims) {
      const status = statusById.get(id);
      if (status === "reachable") continue;
      const reason = status === undefined ? "is not a ledger row" : `is ${status}, not reachable`;
      problems.push(`${paths[0]}: ${label} "reachable:${id}" ${reason}`);
    }
  };
  reportNonReachable(defaultClaims, "step");
  reportNonReachable(debugClaims, "debug step");

  const mapped = [...statusById].filter(
    ([id, status]) => status === "reachable" && defaultClaims.has(id),
  ).length;
  return { ok: problems.length === 0, problems, mapped };
}

function readSpecs() {
  const dir = resolve(ROOT, SPEC_DIR);
  return readdirSync(dir)
    .filter((name) => /\.spec\.[cm]?[jt]sx?$/u.test(name))
    .sort()
    .map((name) => ({
      path: `${SPEC_DIR}/${name}`,
      text: readFileSync(resolve(dir, name), "utf8"),
    }));
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  if (!existsSync(resolve(ROOT, LEDGER_PATH))) {
    console.error(`ui-acceptance-map: ${LEDGER_PATH} is missing`);
    process.exit(1);
  }
  const ledger = JSON.parse(readFileSync(resolve(ROOT, LEDGER_PATH), "utf8"));
  const result = evaluateMap({ ledger, specs: readSpecs() });
  for (const problem of result.problems) console.error(`ui-acceptance-map: ${problem}`);
  if (result.ok) console.log(`ui-acceptance-map: ok (${result.mapped} reachable rows mapped)`);
  process.exit(result.ok ? 0 : 1);
}
