#!/usr/bin/env node
// YAML boundary gate (ADR-0334). YAML is deprecated repository-wide: it is
// permitted only for localization catalogues and for a closed set of externally
// mandated infrastructure files. Every other tracked `.yaml`/`.yml` path is
// migration debt, listed in scripts/data/yaml-boundary.ratchet.json, and the
// ratchet may only shrink.
//
// The gate inspects the git index (tracked plus staged paths), never only the
// changed set, so a new YAML file cannot arrive by not running the gate on the
// rest of the tree. With `--base` it also rejects growth of the ratchet itself,
// which is the only way an author could otherwise legalise a new file.
//
// Usage: `node scripts/assert-no-foreign-yaml.mjs [--base <ref>] [--self-test|--write]`
//   (default)  fail on foreign YAML outside the ratchet, on stale ratchet entries,
//              and (with --base) on any ratchet entry added since <ref>
//   --self-test exercise the classifier and both directions of the diff with fixtures
//   --write     re-seed the ratchet from the current inventory (one deliberate change)
//
// Wired into `pnpm preflight` as `gate:yaml-boundary` (+ `gate:yaml-boundary-self-test`).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { isEntryPoint } from "./lib/paths.mjs";

const ROOT = resolve(import.meta.dirname, "..");
export const RATCHET_PATH = "scripts/data/yaml-boundary.ratchet.json";

/**
 * The internationalization exception. A path qualifies only when it is a locale
 * catalogue directly under a pack's `ui/` directory, named for its locale
 * (`en-US.yaml`, `pt.yaml`). Nothing about a file's content can widen this.
 */
export const INTERNATIONALIZATION =
  /^content\/production\/[^/]+\/ui\/[a-z]{2}(?:-[A-Z]{2})?\.ya?ml$/u;

/**
 * Externally mandated YAML: the format is imposed by a third-party tool, the file
 * carries no application-owned data, and each entry names its owning tool and the
 * evidence of the requirement. Never use this list for repository-owned data.
 */
export const INFRASTRUCTURE = [
  {
    id: "pnpm",
    prefixes: ["pnpm-workspace.yaml", "pnpm-lock.yaml"],
    tool: "pnpm",
    evidence:
      "pnpm reads workspace membership only from pnpm-workspace.yaml and writes its lockfile as pnpm-lock.yaml; neither has a non-YAML form.",
    owner: "workspace toolchain (root package.json)",
  },
  {
    id: "github",
    prefixes: [".github/workflows/", ".github/dependabot.yml"],
    tool: "GitHub Actions / Dependabot",
    evidence:
      "GitHub reads workflow definitions only from .github/workflows/*.yml|yaml and Dependabot configuration only from .github/dependabot.yml.",
    owner: ".github/",
  },
  {
    id: "vendored-skills",
    prefixes: [".agents/"],
    tool: "vendored third-party agent skills",
    evidence:
      "Upstream skill packages ship agents/openai.yaml metadata and their own .github templates; AGENTS.md treats .agents/** as vendored reference material that is never reformatted.",
    owner: "vendored; owned upstream",
  },
];

/**
 * @param {string} path repository-relative POSIX path
 * @returns {"internationalization" | "infrastructure" | "foreign"}
 */
export function classifyPath(path) {
  if (INTERNATIONALIZATION.test(path)) return "internationalization";
  const infrastructure = INFRASTRUCTURE.some((entry) =>
    entry.prefixes.some((prefix) =>
      prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
    ),
  );
  return infrastructure ? "infrastructure" : "foreign";
}

/**
 * Split a tracked inventory into the three categories; each list is sorted.
 * @param {readonly string[]} paths
 */
export function classifyAll(paths) {
  const out = { internationalization: [], infrastructure: [], foreign: [] };
  for (const path of [...paths].sort()) out[classifyPath(path)].push(path);
  return out;
}

/**
 * Compare the tracked inventory with the ratchet.
 * @param {{internationalization: string[], infrastructure: string[], foreign: string[]}} inventory
 * @param {{entries: readonly string[]}} ratchet
 */
export function diffInventory(inventory, ratchet) {
  const listed = new Set(ratchet.entries);
  const foreign = new Set(inventory.foreign);
  return {
    added: inventory.foreign.filter((path) => !listed.has(path)),
    stale: [...listed].filter((path) => !foreign.has(path)).sort(),
    foreign: inventory.foreign,
  };
}

/**
 * Ratchet entries present now but absent at a git ref. A removal never fails; an
 * addition always does, so an author cannot legalise a new YAML file by editing
 * the ratchet. When the ratchet does not exist at `base` this is the seeding
 * change itself, and there is nothing to compare against: returns `null`.
 * @param {string} root
 * @param {string} base
 * @returns {string[] | null}
 */
export function ratchetAdditionsSince(root, base) {
  let baseText;
  try {
    baseText = execFileSync("git", ["show", `${base}:${RATCHET_PATH}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
  const before = new Set(JSON.parse(baseText).entries ?? []);
  return readRatchet(root).entries.filter((entry) => !before.has(entry));
}

export function readRatchet(root) {
  const raw = JSON.parse(readFileSync(resolve(root, RATCHET_PATH), "utf8"));
  if (!Array.isArray(raw.entries)) throw new Error(`${RATCHET_PATH}: "entries" must be an array`);
  return raw;
}

/** Tracked plus staged YAML paths (the git index), never only the changed set. */
export function listTrackedYaml(root) {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--", "*.yaml", "*.yml"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

export function writeRatchet(root, inventory) {
  const entries = inventory.foreign;
  writeFileSync(
    resolve(root, RATCHET_PATH),
    `${JSON.stringify(
      {
        comment:
          "YAML migration debt (ADR-0334). Every path here is foreign YAML that must migrate to TypeScript or canonical JSON. This list may only shrink: scripts/assert-no-foreign-yaml.mjs fails on a tracked path that is unlisted, on a listed path that no longer exists, and (with --base) on any entry added since the base ref. Regenerate deliberately with --write.",
        version: 1,
        entries,
      },
      null,
      2,
    )}\n`,
  );
  return entries.length;
}

/**
 * @param {string} root
 * @param {{base?: string}} [options]
 */
export function verifyYamlBoundary(root = ROOT, options = {}) {
  const inventory = classifyAll(listTrackedYaml(root));
  const ratchet = readRatchet(root);
  const { added, stale } = diffInventory(inventory, ratchet);
  const problems = [];
  if (added.length > 0) {
    problems.push(
      "new non-internationalization YAML is not allowed (ADR-0334). Author domain content as " +
        "TypeScript under content/production/<pack>/ or emit canonical JSON. Foreign paths not " +
        `in the ratchet:\n${added.map((path) => `  ${path}`).join("\n")}`,
    );
  }
  if (stale.length > 0) {
    problems.push(
      `ratchet entries that are no longer foreign YAML must be deleted (the ratchet only shrinks):\n${stale
        .map((path) => `  ${path}`)
        .join("\n")}`,
    );
  }
  if (options.base !== undefined) {
    const gained = ratchetAdditionsSince(root, options.base) ?? [];
    if (gained.length > 0) {
      problems.push(
        `the migration ratchet gained ${String(gained.length)} entry(ies) since ${options.base}; ` +
          `it may only shrink (ADR-0334):\n${gained.map((path) => `  ${path}`).join("\n")}`,
      );
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n\n"));
  return { inventory, entries: ratchet.entries.length };
}

export function formatInventory(inventory) {
  return [
    `  internationalization: ${String(inventory.internationalization.length)}`,
    `  infrastructure (externally mandated): ${String(inventory.infrastructure.length)}`,
    `  foreign (migration debt): ${String(inventory.foreign.length)}`,
  ].join("\n");
}

const SELF_TEST_CASES = [
  ["locale catalogue", "content/production/1880/ui/en-US.yaml", "internationalization"],
  ["regional locale", "content/production/1880/ui/pt-BR.yaml", "internationalization"],
  [".yml locale", "content/production/1880/ui/de.yml", "internationalization"],
  ["nested ui path", "content/production/1880/ui/nested/en-US.yaml", "foreign"],
  ["pack-level yaml", "content/production/1880/countries.yaml", "foreign"],
  [
    "component catalogue",
    "content/production/1880/ship-building/components/guns/french.yaml",
    "foreign",
  ],
  ["electron-builder config", "apps/desktop/electron-builder.yml", "foreign"],
  ["pnpm workspace", "pnpm-workspace.yaml", "infrastructure"],
  ["pnpm lock", "pnpm-lock.yaml", "infrastructure"],
  ["workflow", ".github/workflows/gates.yml", "infrastructure"],
  ["dependabot", ".github/dependabot.yml", "infrastructure"],
  ["vendored skill metadata", ".agents/skills/tdd/agents/openai.yaml", "infrastructure"],
];

export function runSelfTest() {
  const failures = [];
  const report = [];
  for (const [name, path, expected] of SELF_TEST_CASES) {
    const actual = classifyPath(path);
    const ok = actual === expected;
    report.push(`  ${ok ? "ok  " : "FAIL"} fixture "${name}": ${path} -> ${expected}`);
    if (!ok) failures.push(`${name}: expected ${expected}, got ${actual}`);
  }

  const inventory = classifyAll(SELF_TEST_CASES.map(([, path]) => path));
  const seeded = diffInventory(inventory, { entries: inventory.foreign });
  if (seeded.added.length !== 0 || seeded.stale.length !== 0) {
    failures.push("a ratchet seeded from the inventory must be clean");
  }
  const empty = diffInventory(inventory, { entries: [] });
  if (empty.added.length !== inventory.foreign.length) {
    failures.push("an empty ratchet must report every foreign path");
  }
  const shrunk = diffInventory(inventory, {
    entries: inventory.foreign.filter((path) => path !== "content/production/1880/countries.yaml"),
  });
  if (shrunk.added.length !== 1 || shrunk.added[0] !== "content/production/1880/countries.yaml") {
    failures.push("dropping a ratchet entry must report that path as new debt");
  }
  const stale = diffInventory(inventory, {
    entries: [...inventory.foreign, "content/production/1880/ui/gone.yaml"],
  });
  if (stale.stale.length !== 1 || stale.stale[0] !== "content/production/1880/ui/gone.yaml") {
    failures.push("a ratchet entry for a deleted file must be reported as stale");
  }
  return { ok: failures.length === 0, failures, report, total: SELF_TEST_CASES.length + 4 };
}

/** Resolve the comparison ref for the growth check, or undefined when absent. */
export function defaultBase(root = ROOT) {
  for (const ref of ["origin/dev", "origin/main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
        cwd: root,
        stdio: "ignore",
      });
      return ref;
    } catch {}
  }
  return undefined;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    console.log("assert-no-foreign-yaml: self-test");
    const { ok, failures, report, total } = runSelfTest();
    for (const line of report) console.log(line);
    for (const failure of failures) console.error(`  ${failure}`);
    if (!ok) {
      console.error(`assert-no-foreign-yaml: self-test FAILED (${String(failures.length)})`);
      process.exitCode = 1;
      return;
    }
    console.log(`assert-no-foreign-yaml: self-test ok (${String(total)} cases)`);
    return;
  }
  if (args.includes("--write")) {
    const count = writeRatchet(ROOT, classifyAll(listTrackedYaml(ROOT)));
    console.log(`assert-no-foreign-yaml: wrote ${RATCHET_PATH} with ${String(count)} entr(ies)`);
    return;
  }
  const baseIndex = args.indexOf("--base");
  const base = baseIndex === -1 ? defaultBase() : args[baseIndex + 1];
  const { inventory, entries } = verifyYamlBoundary(ROOT, { base });
  console.log("assert-no-foreign-yaml: inventory");
  console.log(formatInventory(inventory));
  console.log(
    base === undefined
      ? "  ratchet growth check: skipped (no base ref resolvable)"
      : `  ratchet growth check: ${base}`,
  );
  console.log(`assert-no-foreign-yaml: ok (${String(entries)} ratchet entries remaining)`);
}

if (isEntryPoint(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      `assert-no-foreign-yaml: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
