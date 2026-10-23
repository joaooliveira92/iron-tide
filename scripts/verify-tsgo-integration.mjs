#!/usr/bin/env node
// tsgo integration gate (ADR-0139, ADR-0100/0101). The install-time
// `effect-tsgo patch --typescript --oxlint` (root `prepare`) is what actually
// wires the Effect language service into the TypeScript-Go server and the Oxlint
// binary. This gate proves two things: (1) the toolchain the root package.json
// pins matches the matrix the installed @effect/tsgo supports, and (2) the patch
// left its `.original` backups beside each patched binary — so a version drift,
// a missing package, or an unpatched install fails loudly instead of silently
// dropping the Effect diagnostics (which ADR-0101 §7 makes Oxlint's job alone).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const rootRequire = createRequire(resolve(ROOT, "package.json"));

// The toolchain matrix each @effect/tsgo release supports. Keep in step with
// `effect-tsgo`'s supported-versions table and with the exact `pnpm` pins in the
// root package.json (ADR-0100/0101). An unknown @effect/tsgo version fails
// closed rather than assuming the pins are fine.
export const TSGO_MATRIX = {
  "0.51.1": { typescript: "7.0.2", oxlint: "1.87.0", "oxlint-tsgolint": "7.0.2003" },
  "0.54.1": { typescript: "7.0.2", oxlint: "1.89.0", "oxlint-tsgolint": "7.0.2004" },
};

// Each patched integration: the parent package to resolve, and a human label.
const PATCHED_INTEGRATIONS = [
  { label: "typescript", from: "typescript" },
  { label: "oxlint", from: "oxlint" },
  { label: "oxlint-tsgolint", from: "oxlint-tsgolint" },
];

/**
 * Compare the root package.json pins with the matrix supported by the installed
 * @effect/tsgo. Returns a problem per drifted pin, and a single problem when the
 * installed version is not in the matrix.
 * @param {{ tsgoVersion: string, matrix: Record<string, Record<string, string>>, pinned: Record<string, string> }} input
 * @returns {string[]}
 */
export function checkToolchainVersions({ tsgoVersion, matrix, pinned }) {
  const expected = matrix[tsgoVersion];
  if (expected === undefined) {
    return [
      `@effect/tsgo ${tsgoVersion} is not in TSGO_MATRIX; record the matrix this release supports`,
    ];
  }
  const problems = [];
  for (const [name, version] of Object.entries(expected)) {
    if (pinned[name] !== version) {
      problems.push(
        `${name} is pinned "${pinned[name]}" but @effect/tsgo ${tsgoVersion} supports "${version}"`,
      );
    }
  }
  return problems;
}

/**
 * Recursively collect files matching `*.original` under a directory, up to a
 * bounded depth. `effect-tsgo patch` writes these beside each binary it replaces.
 * @param {string} dir
 * @param {number} [maxDepth]
 * @returns {string[]}
 */
export function findOriginalFiles(dir, maxDepth = 4) {
  if (!existsSync(dir)) return [];
  const found = [];
  const walk = (current, depth) => {
    if (depth > maxDepth) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path, depth + 1);
      else if (entry.name.endsWith(".original")) found.push(path);
    }
  };
  walk(dir, 0);
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Resolve the platform-specific package pnpm installed for a parent package by
 * probing its optionalDependencies. Only the current platform's optional dep is
 * installed, so the first that resolves is the one carrying the native binary.
 * @param {string} parentPackageJson absolute path to the parent's package.json
 * @returns {{ name: string, dir: string } | undefined}
 */
export function resolveInstalledPlatformPackage(parentPackageJson) {
  const parent = JSON.parse(readFileSync(parentPackageJson, "utf8"));
  const require = createRequire(parentPackageJson);
  for (const name of Object.keys(parent.optionalDependencies ?? {})) {
    try {
      const resolved = require.resolve(`${name}/package.json`);
      return { name, dir: dirname(resolved) };
    } catch {
      // Not the current platform's package; keep probing.
    }
  }
  return undefined;
}

/** @returns {string[]} problems, empty when the toolchain is patched and coherent. */
function checkInstall() {
  const problems = [];
  let tsgoPackageJson;
  try {
    tsgoPackageJson = rootRequire.resolve("@effect/tsgo/package.json");
  } catch {
    return ["@effect/tsgo is not installed; run `pnpm install` before this gate"];
  }
  const tsgoVersion = JSON.parse(readFileSync(tsgoPackageJson, "utf8")).version;
  const { devDependencies = {} } = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const pinned = {
    "@effect/tsgo": devDependencies["@effect/tsgo"],
    typescript: devDependencies.typescript,
    oxlint: devDependencies.oxlint,
    "oxlint-tsgolint": devDependencies["oxlint-tsgolint"],
  };
  problems.push(...checkToolchainVersions({ tsgoVersion, matrix: TSGO_MATRIX, pinned }));

  for (const { label, from } of PATCHED_INTEGRATIONS) {
    let parentPackageJson;
    try {
      parentPackageJson = rootRequire.resolve(`${from}/package.json`);
    } catch {
      problems.push(`${label} is not installed; run \`pnpm install\` before this gate`);
      continue;
    }
    const platform = resolveInstalledPlatformPackage(parentPackageJson);
    if (platform === undefined) {
      problems.push(`${label} has no platform package installed`);
      continue;
    }
    if (findOriginalFiles(platform.dir).length === 0) {
      problems.push(
        `${label} is unpatched: no \`.original\` backup in ${platform.name} ` +
          `(the \`prepare\` \`effect-tsgo patch\` step did not run)`,
      );
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    const problems = checkInstall();
    if (problems.length > 0) {
      for (const problem of problems) console.error(`tsgo-integration: ${problem}`);
      process.exit(1);
    }
    const { devDependencies = {} } = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf8"),
    );
    console.log(
      `tsgo-integration: ok (@effect/tsgo ${devDependencies["@effect/tsgo"]}, ` +
        `typescript ${devDependencies.typescript}, oxlint ${devDependencies.oxlint}, ` +
        `tsgolint ${devDependencies["oxlint-tsgolint"]}; patched)`,
    );
  } catch (error) {
    console.error(`tsgo-integration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
