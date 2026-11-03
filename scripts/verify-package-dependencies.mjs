#!/usr/bin/env node
// Enforce the workspace dependency policy.
//
// A gate for the manifest layer, complementing the lockfile-level single-copy
// guard (`assert-single-effect.mjs`) and `pnpm audit`:
//   1. no floating specifiers (*, latest, next, x, empty);
//   2. the runtime `effect` / `@effect/vitest` are always `workspace:*`
//      (reinforces the single-copy invariant where it is declared, not just
//      where it resolves);
//   3. internal `@bluewave/*` dependencies always use the `workspace:` protocol;
//   4. the pinned toolchain is exact (`@effect/tsgo`, `oxlint`,
//      `oxlint-tsgolint`, `typescript`, `oxc-parser`) — see ADR-0100/0101.
//
// Usage: `node scripts/verify-package-dependencies.mjs`
// Wired into `pnpm preflight` (via `scripts/run-gates.mjs`).

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FLOATING = new Set(["*", "latest", "next", "x", ""]);
const SINGLE_COPY = new Set(["effect", "@effect/vitest"]);
const PINNED_TOOLCHAIN = new Set([
  "@effect/tsgo",
  "oxlint",
  "oxlint-tsgolint",
  "typescript",
  "oxc-parser",
]);
const EXACT = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/u;
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** Workspace manifests the policy governs (root + packages/* + apps/*). */
export function manifestPaths(root = ROOT) {
  const paths = ["package.json"];
  for (const group of ["packages", "apps"]) {
    for (const entry of readdirSync(resolve(root, group), { withFileTypes: true })) {
      if (entry.isDirectory()) paths.push(`${group}/${entry.name}/package.json`);
    }
  }
  return paths.filter((path) => {
    try {
      readFileSync(resolve(root, path));
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Check one manifest's declared dependency specifiers.
 * @param {string} file - repository-relative manifest path.
 * @param {object} pkg - parsed package.json.
 * @returns {Array<{ file: string, name: string, specifier: string, reason: string }>}
 */
export function checkManifest(file, pkg) {
  const violations = [];
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (deps === undefined || deps === null || typeof deps !== "object") continue;
    for (const [name, specifier] of Object.entries(deps)) {
      const record = { file, name, specifier: String(specifier), reason: "" };
      if (FLOATING.has(String(specifier))) {
        violations.push({ ...record, reason: "floating specifier" });
      } else if (SINGLE_COPY.has(name) && specifier !== "workspace:*") {
        violations.push({
          ...record,
          reason: "effect must be a workspace link (single-copy invariant)",
        });
      } else if (name.startsWith("@bluewave/") && !String(specifier).startsWith("workspace:")) {
        violations.push({ ...record, reason: "internal package must use the workspace: protocol" });
      } else if (PINNED_TOOLCHAIN.has(name) && !EXACT.test(String(specifier))) {
        violations.push({ ...record, reason: "toolchain dependency must be pinned exact" });
      }
    }
  }
  return violations;
}

function main() {
  const violations = [];
  for (const file of manifestPaths()) {
    violations.push(...checkManifest(file, JSON.parse(readFileSync(resolve(ROOT, file), "utf8"))));
  }
  if (violations.length > 0) {
    console.error("verify-package-dependencies: FAILED\n");
    for (const v of violations)
      console.error(`  ${v.file}: ${v.name}@${v.specifier} — ${v.reason}`);
    process.exit(1);
  }
  console.log(`verify-package-dependencies: ok (${manifestPaths().length} manifests conform).`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
