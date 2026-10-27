#!/usr/bin/env node
// Keep per-package `AGENTS.md` files honest. Each package either carries a
// short AGENTS.md (role, class, boundary, invariants) or is listed in EXEMPT
// with a reason, so a new package forces an explicit decision. The `Class`
// line is checked against the runtime-free gate (`RUNTIME_FREE_ROOTS`), so the
// boundary an agent reads cannot drift from the one CI enforces.
//
// Usage: `node scripts/verify-package-agents.mjs [--self-test]`
// Wired into `pnpm preflight`.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { RUNTIME_FREE_ROOTS } from "./assert-runtime-free.mjs";
import { isEntryPoint } from "./lib/paths.mjs";

const root = resolve(import.meta.dirname, "..");

/** Packages whose constraints are fully covered by the root AGENTS.md and gates. */
export const EXEMPT = {
  "content-codemod": "tooling; covered by the codemod determinism gate",
  diagnostics: "leaf collector; no package-specific constraints",
};

export const CLASSES = ["runtime-free", "io-boundary"];
const SECTIONS = ["**Role:**", "**Class:**", "**Boundary:**", "**Invariants:**"];

/**
 * Check one package's AGENTS.md text.
 * @param {string} name package directory name
 * @param {string} text file contents
 * @param {Set<string>} runtimeFree package names guarded by the runtime-free gate
 * @returns {string[]} problems
 */
export function checkAgentsDoc(name, text, runtimeFree) {
  const problems = [];
  if (!text.startsWith(`# @bluewave/${name}\n`))
    problems.push(`title must be "# @bluewave/${name}"`);
  for (const section of SECTIONS) {
    if (!text.includes(section)) problems.push(`missing ${section}`);
  }
  if (!text.includes("](../../AGENTS.md)")) problems.push("must link ../../AGENTS.md");
  const declared = /^\*\*Class:\*\* (\S+)$/mu.exec(text)?.[1];
  if (declared !== undefined) {
    const expected = runtimeFree.has(name) ? "runtime-free" : "io-boundary";
    if (!CLASSES.includes(declared))
      problems.push(`Class "${declared}" is not one of ${CLASSES.join(", ")}`);
    else if (declared !== expected) {
      problems.push(`Class is "${declared}" but the runtime-free gate implies "${expected}"`);
    }
  }
  return problems;
}

/**
 * @param {string} repoRoot
 * @param {Record<string, number>} manifest doc-budget manifest
 * @returns {string[]} violations
 */
export function verifyPackageAgents(
  repoRoot,
  manifest,
  roots = RUNTIME_FREE_ROOTS,
  exempt = EXEMPT,
) {
  const runtimeFree = new Set(
    roots.filter((r) => r.startsWith("packages/")).map((r) => r.split("/")[1]),
  );
  const violations = [];
  const names = readdirSync(resolve(repoRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of names) {
    const rel = `packages/${name}/AGENTS.md`;
    const abs = resolve(repoRoot, rel);
    const has = existsSync(abs);
    if (name in exempt) {
      if (has) violations.push(`${rel}: exists but "${name}" is listed in EXEMPT; remove one`);
      continue;
    }
    if (!has) {
      violations.push(`${rel}: missing (add it, or list "${name}" in EXEMPT with a reason)`);
      continue;
    }
    for (const problem of checkAgentsDoc(name, readFileSync(abs, "utf8"), runtimeFree)) {
      violations.push(`${rel}: ${problem}`);
    }
    if (!(rel in manifest)) violations.push(`${rel}: not in scripts/doc-budgets.manifest.json`);
  }
  for (const name of Object.keys(exempt)) {
    if (!names.includes(name)) violations.push(`EXEMPT lists unknown package "${name}"`);
  }
  return violations;
}

const GOOD = `# @bluewave/x

**Role:** r.

**Class:** runtime-free

**Boundary:** b.

**Invariants:**
- i

See [AGENTS.md](../../AGENTS.md).
`;

export function runSelfTest() {
  const free = new Set(["x"]);
  const cases = [
    ["conforming doc passes", "x", GOOD, 0],
    ["wrong title fails", "x", GOOD.replace("@bluewave/x", "@bluewave/y"), 1],
    ["missing Invariants fails", "x", GOOD.replace("**Invariants:**", ""), 1],
    ["missing root link fails", "x", GOOD.replace("../../AGENTS.md", "x"), 1],
    ["class contradicting the gate fails", "x", GOOD.replace("runtime-free", "io-boundary"), 1],
    ["unknown class fails", "x", GOOD.replace("runtime-free", "pure"), 1],
    [
      "io-boundary package outside the gate passes",
      "z",
      GOOD.replace("x", "z").replace("runtime-free", "io-boundary"),
      0,
    ],
  ];
  let failed = 0;
  console.log("verify-package-agents: self-test");
  for (const [label, name, text, want] of cases) {
    const got = checkAgentsDoc(name, text, free).length > 0 ? 1 : 0;
    const ok = got === want;
    if (!ok) failed += 1;
    console.log(`  ${ok ? "ok  " : "FAIL"} fixture "${label}"`);
  }
  if (failed > 0) {
    console.error(`verify-package-agents: self-test FAILED (${failed})`);
    process.exit(1);
  }
  console.log(`verify-package-agents: self-test ok (${cases.length} fixtures)`);
}

if (isEntryPoint(import.meta.url)) {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
  } else {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "scripts/doc-budgets.manifest.json"), "utf8"),
    );
    const violations = verifyPackageAgents(root, manifest);
    if (violations.length > 0) {
      console.error("verify-package-agents: FAILED\n");
      for (const v of violations) console.error(`  ${v}`);
      process.exit(1);
    }
    console.log("verify-package-agents: ok (every package has an AGENTS.md or an exemption).");
  }
}
