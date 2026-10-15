#!/usr/bin/env node
// Vitest config-parity gate (maintainability-hardening ticket 03).
//
// Every workspace package (`packages/*`, `apps/*`) must run Vitest through one
// shared baseline (`scripts/vitest-shared.mjs`) that pins a deliberate,
// load-tolerant `testTimeout` and the shared on-disk module cache. A package
// whose `vitest.config.*` is missing, or whose config no longer imports the
// baseline, silently reverts to Vitest's 5s default timeout and its own
// (unpersisted) transform cache — the exact drift that made the content-codemod
// suite flake under gate load when it had no config of its own. This gate fails
// closed, naming the package, so a new package or a dropped import is caught at
// preflight instead of under load.
//
// Usage:
//   node scripts/verify-vitest-config-parity.mjs              # check the workspace
//   node scripts/verify-vitest-config-parity.mjs --self-test  # embedded fixtures
//
// The checks are pure `checkConfigParity`/`checkBaseline` functions; they read
// no clock, RNG, environment, or network.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/** The baseline module every workspace config must import. */
export const BASELINE_MODULE = "scripts/vitest-shared.mjs";
/** The baseline symbol a config must spread into its `test` block. */
const BASELINE_SYMBOL = "sharedTestConfig";
/** The workspace areas that carry their own test config. */
const WORKSPACE_AREAS = ["packages", "apps"];
/** Accepted config filenames, in discovery order. */
const CONFIG_FILENAMES = ["vitest.config.ts", "vitest.config.mts"];
/** Vitest's own default per-test timeout, in ms — the floor a load-tolerant baseline must clear. */
const VITEST_DEFAULT_TEST_TIMEOUT = 5000;

const MODULE_BASENAME = BASELINE_MODULE.split("/").at(-1).replaceAll(".", "\\.");
// A real named import from the baseline module (line-anchored, so the tokens in
// a comment cannot satisfy it)...
const BASELINE_IMPORT_RE = new RegExp(
  `^\\s*import\\b[^;]*\\{[^}]*\\b${BASELINE_SYMBOL}\\b[^}]*\\}[^;]*from\\s*["'][^"']*${MODULE_BASENAME}["']`,
  "mu",
);
// ...together with the spread that actually applies the defaults.
const BASELINE_SPREAD_RE = new RegExp(`\\.\\.\\.\\s*${BASELINE_SYMBOL}\\b`, "u");

/**
 * Does a config source import the shared baseline and spread its symbol?
 * Requires both a real named import from `scripts/vitest-shared.mjs` and a
 * `...sharedTestConfig` spread, so a hand-rolled config — or one that merely
 * names the baseline in a comment — cannot satisfy the gate.
 * @param {string} text
 * @returns {boolean}
 */
export function importsSharedBaseline(text) {
  return BASELINE_IMPORT_RE.test(text) && BASELINE_SPREAD_RE.test(text);
}

/**
 * Every project must resolve to a config that inherits the baseline.
 * @param {{
 *   projects: { dir: string, name: string }[],
 *   readConfig: (dir: string) => { path: string, text: string } | undefined,
 * }} input
 * @returns {string[]} problems, empty when every project is covered.
 */
export function checkConfigParity({ projects, readConfig }) {
  const problems = [];
  for (const { dir, name } of projects) {
    const config = readConfig(dir);
    if (config === undefined) {
      problems.push(
        `${name} (${dir}): no vitest config — every workspace package must run ` +
          `Vitest with the shared baseline (${BASELINE_MODULE})`,
      );
      continue;
    }
    if (!importsSharedBaseline(config.text)) {
      problems.push(
        `${name} (${dir}): ${config.path} does not import the shared baseline ` +
          `(${BASELINE_MODULE} \`${BASELINE_SYMBOL}\`)`,
      );
    }
  }
  return problems;
}

/**
 * The baseline itself must carry a deliberate, load-tolerant timeout and the
 * shared cache.
 * @param {{ testTimeout?: unknown, fsModuleCache?: unknown } | undefined} sharedTestConfig
 * @returns {string[]}
 */
export function checkBaseline(sharedTestConfig) {
  const problems = [];
  const timeout = sharedTestConfig?.testTimeout;
  if (
    typeof timeout !== "number" ||
    !Number.isFinite(timeout) ||
    timeout <= VITEST_DEFAULT_TEST_TIMEOUT
  ) {
    problems.push(
      `shared baseline must set an explicit \`testTimeout\` above Vitest's ` +
        `${VITEST_DEFAULT_TEST_TIMEOUT}ms default (${BASELINE_MODULE})`,
    );
  }
  if (sharedTestConfig?.fsModuleCache !== true) {
    problems.push(
      `shared baseline must enable the shared module cache \`fsModuleCache: true\` (${BASELINE_MODULE})`,
    );
  }
  return problems;
}

/**
 * Discover the workspace packages that must carry a test config.
 * @param {string} root
 * @returns {{ dir: string, name: string }[]}
 */
function discoverProjects(root) {
  const projects = [];
  for (const area of WORKSPACE_AREAS) {
    const areaDir = resolve(root, area);
    if (!existsSync(areaDir)) continue;
    for (const entry of readdirSync(areaDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const pkgPath = resolve(areaDir, entry.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const dir = `${area}/${entry.name}`;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      projects.push({ dir, name: typeof pkg.name === "string" ? pkg.name : dir });
    }
  }
  return projects.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
}

/**
 * Read a project's config from disk, first filename that exists.
 * @param {string} root
 * @param {string} dir
 * @returns {{ path: string, text: string } | undefined}
 */
function readProjectConfig(root, dir) {
  for (const filename of CONFIG_FILENAMES) {
    const path = resolve(root, dir, filename);
    if (existsSync(path)) return { path: `${dir}/${filename}`, text: readFileSync(path, "utf8") };
  }
  return undefined;
}

// The gate proves its own boundary: an absent config and a config that dropped
// the baseline both fail, naming the package; an inheriting config passes; and a
// baseline missing either pinned key fails.
const BASELINE_CONFIG = [
  'import { defineConfig } from "vite-plus";',
  'import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";',
  "",
  "export default defineConfig({ test: { ...sharedTestConfig } });",
].join("\n");

const SELF_TEST_CASES = [
  {
    name: "config inheriting the baseline passes",
    configs: { "packages/keeper": BASELINE_CONFIG },
    expectProblems: [],
  },
  {
    name: "absent config fails, naming the package",
    configs: {},
    expectProblems: ["@bluewave/keeper (packages/keeper): no vitest config"],
  },
  {
    name: "config without the baseline import fails, naming the package",
    configs: {
      "packages/keeper": "export default { test: { testTimeout: 15000 } };\n",
    },
    expectProblems: ["@bluewave/keeper (packages/keeper): packages/keeper/vitest.config.ts"],
  },
  {
    name: "an import that is never spread fails",
    configs: {
      "packages/keeper": [
        'import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";',
        "export default { test: sharedTestConfig ? {} : {} };",
      ].join("\n"),
    },
    expectProblems: ["@bluewave/keeper (packages/keeper): packages/keeper/vitest.config.ts"],
  },
  {
    name: "the baseline named only in a comment fails",
    configs: {
      "packages/keeper": [
        '// import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";',
        "export default { test: { testTimeout: 15000 } };",
      ].join("\n"),
    },
    expectProblems: ["@bluewave/keeper (packages/keeper): packages/keeper/vitest.config.ts"],
  },
];

const BASELINE_SELF_TEST_CASES = [
  {
    name: "a baseline with both keys passes",
    value: { testTimeout: 15000, fsModuleCache: true },
    want: 0,
  },
  { name: "a baseline missing testTimeout fails", value: { fsModuleCache: true }, want: 1 },
  { name: "a baseline without the shared cache fails", value: { testTimeout: 15000 }, want: 1 },
  {
    name: "a baseline at Vitest's default timeout fails",
    value: { testTimeout: 5000, fsModuleCache: true },
    want: 1,
  },
];

const PROJECTS_FOR_FIXTURES = [{ dir: "packages/keeper", name: "@bluewave/keeper" }];

/** @param {Record<string, string | undefined>} configs */
function fixtureReadConfig(configs) {
  return (dir) =>
    Object.hasOwn(configs, dir)
      ? { path: `${dir}/vitest.config.ts`, text: configs[dir] ?? "" }
      : undefined;
}

function selfTest() {
  let failed = 0;
  for (const testCase of SELF_TEST_CASES) {
    const problems = checkConfigParity({
      projects: PROJECTS_FOR_FIXTURES,
      readConfig: fixtureReadConfig(testCase.configs),
    });
    const matches =
      problems.length === testCase.expectProblems.length &&
      testCase.expectProblems.every((prefix, i) => problems[i].startsWith(prefix));
    if (!matches) {
      console.error(
        `self-test FAILED: ${testCase.name} — expected ${JSON.stringify(testCase.expectProblems)}, got ${JSON.stringify(problems)}`,
      );
      failed += 1;
    }
  }
  for (const testCase of BASELINE_SELF_TEST_CASES) {
    const got = checkBaseline(testCase.value).length;
    if (got !== testCase.want) {
      console.error(`self-test FAILED: ${testCase.name} expected ${testCase.want}, got ${got}`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error(`verify-vitest-config-parity: ${failed} self-test(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-vitest-config-parity: self-test passed (${
      SELF_TEST_CASES.length + BASELINE_SELF_TEST_CASES.length
    } cases)`,
  );
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const { sharedTestConfig } = await import("./vitest-shared.mjs");
  const projects = discoverProjects(ROOT);
  if (projects.length === 0)
    throw new Error("no workspace packages found under packages/ or apps/");
  const problems = [
    ...checkBaseline(sharedTestConfig),
    ...checkConfigParity({
      projects,
      readConfig: (dir) => readProjectConfig(ROOT, dir),
    }),
  ];
  if (problems.length > 0) {
    console.error("verify-vitest-config-parity: FAILED — config/baseline drift:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "Fix: import `sharedTestConfig` from `scripts/vitest-shared.mjs` and spread it into\n" +
        "every package's `vitest.config.ts` test block.",
    );
    process.exit(1);
  }
  console.log(`verify-vitest-config-parity: ok (${projects.length} projects inherit the baseline)`);
}

// Only run the CLI when this module is the entrypoint (the idiom the other
// gates use), so importing it from the fixtures runs nothing.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    await main();
  } catch (error) {
    console.error(
      `verify-vitest-config-parity: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
