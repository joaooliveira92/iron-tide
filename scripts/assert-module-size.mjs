#!/usr/bin/env node
// Enforce the TypeScript module-size policy as a ratchet.
//
// Logical lines are non-blank, non-comment lines of a handwritten .ts/.tsx file.
// A file over 600 logical lines or 100 KiB fails unless it is recorded in
// scripts/module-size.baseline.json, and a recorded allowance may only fall:
// growth fails, and an allowance that has shrunk or no longer applies must be
// tightened with --prune (fatal under CI, a warning locally, like the sibling
// verify-no-unknown-casts gate). Files over 400 logical lines or 50 KiB are
// listed as advisory review candidates and never fail the run.
//
// Exempt: generated files (*.generated.ts, *.gen.ts, generated/), *.d.ts,
// fixtures, migrations/, static datasets (content/ and the baked map data files
// listed in STATIC_DATASETS), vendor/, repos/, .agents/, .worktrees/ and
// node_modules.
//
// Usage: node scripts/assert-module-size.mjs [--root <dir>] [--verbose]
//          [--write|--update-baseline|--prune] [--strict] [--self-test]
//   (default)           fail on any new or grown violation, or stale allowance when strict
//   --write             (re)seed the baseline from the current tree (accepts current debt)
//   --update-baseline   alias of --write
//   --prune             lower or delete allowances that no longer apply; never adds
//   --strict            treat stale allowances as fatal (implied by CI)
//   --self-test         exercise the counting and ratchet rules without touching the tree
//
// Wired into `pnpm preflight` as gate:module-size.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const BASELINE_PATH = "scripts/module-size.baseline.json";

export const TARGET_LINES = 300;
export const REVIEW_LINES = 400;
export const HARD_LINES = 600;
export const WARN_BYTES = 50 * 1024;
export const HARD_BYTES = 100 * 1024;

const REQUIRED_AREAS = ["packages/", "apps/"];
const EXEMPT_PREFIXES = ["vendor/", "repos/", ".agents/", ".worktrees/", "content/"];
const EXEMPT_SEGMENTS = new Set([
  "node_modules",
  "generated",
  "__generated__",
  "fixtures",
  "__fixtures__",
  "migrations",
]);
const STATIC_DATASETS = new Set([
  "apps/desktop/src/renderer/components/world-map/borders-1880-data.ts",
  "apps/desktop/src/renderer/components/world-map/coastline-data.ts",
]);
const SOURCE_RE = /\.tsx?$/u;
const EXEMPT_NAME_RE = /(?:\.d|\.generated|\.gen)\.ts$/u;
const WARN_PREVIEW = 10;

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * True for a handwritten TypeScript source the policy measures.
 * @param {string} file - repository-relative path (forward slashes).
 * @returns {boolean}
 */
export function isHandwrittenSource(file) {
  if (!SOURCE_RE.test(file) || EXEMPT_NAME_RE.test(file)) return false;
  if (STATIC_DATASETS.has(file)) return false;
  if (EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  return !file
    .split("/")
    .slice(0, -1)
    .some((segment) => EXEMPT_SEGMENTS.has(segment));
}

/**
 * Count the non-blank, non-comment lines of one source file. Comment ranges come
 * from the parser, so `//` inside strings, template literals, regexes and JSX
 * text is never mistaken for a comment.
 * @param {string} file - path used to select the TS or TSX grammar.
 * @param {string} text - source contents.
 * @returns {number}
 * @throws when the file does not parse (failing closed: an unparsed file could hide its size).
 */
export function countLogicalLines(file, text) {
  const { comments, errors } = parseSync(file, text);
  if (errors.length > 0) {
    throw new Error(
      `assert-module-size: cannot parse ${file}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide its size)",
    );
  }
  const ranges = comments.map(({ start, end }) => [start, end]);
  if (text.startsWith("#!")) {
    const newline = text.indexOf("\n");
    ranges.push([0, newline === -1 ? text.length : newline]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let masked = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    masked += text.slice(cursor, start) + text.slice(start, end).replace(/[^\n]/gu, " ");
    cursor = end;
  }
  masked += text.slice(cursor);
  let count = 0;
  for (const line of masked.split("\n")) {
    if (line.trim() !== "") count += 1;
  }
  return count;
}

function rawNonBlankLines(text) {
  let count = 0;
  for (const line of text.split("\n")) {
    if (line.trim() !== "") count += 1;
  }
  return count;
}

/**
 * Measure one file. Files that cannot reach the review threshold on raw
 * non-blank lines skip the parse; their `lines` is that upper bound.
 * @param {string} file
 * @param {string} text
 * @param {number} bytes
 * @returns {{file: string, lines: number, bytes: number}}
 */
export function measureFile(file, text, bytes) {
  const raw = rawNonBlankLines(text);
  return { file, lines: raw > REVIEW_LINES ? countLogicalLines(file, text) : raw, bytes };
}

/**
 * Apply the policy to measured files against the recorded allowances.
 * @param {ReadonlyArray<{file: string, lines: number, bytes: number}>} entries
 * @param {Record<string, {lines?: number, bytes?: number}>} baseline
 * @returns {{violations: string[], tighten: string[], warnings: string[]}}
 */
export function evaluateModuleSizes(entries, baseline) {
  const violations = [];
  const tighten = [];
  const warnings = [];
  const dimensions = [
    { key: "lines", hard: HARD_LINES, review: REVIEW_LINES, label: "logical lines" },
    { key: "bytes", hard: HARD_BYTES, review: WARN_BYTES, label: "bytes" },
  ];
  const present = new Set();
  for (const entry of [...entries].sort((a, b) => byCodeUnit(a.file, b.file))) {
    present.add(entry.file);
    const allowance = baseline[entry.file] ?? {};
    let baselined = false;
    let reviewable = false;
    for (const { key, hard, review, label } of dimensions) {
      const value = entry[key];
      const allowed = allowance[key];
      if (value > hard) {
        if (allowed === undefined) {
          violations.push(`${entry.file}: ${value} ${label} exceeds the hard limit of ${hard}`);
        } else if (value > allowed) {
          violations.push(
            `${entry.file}: grew from ${allowed} to ${value} ${label} (hard limit ${hard}, baselined files may not grow)`,
          );
        } else {
          baselined = true;
          if (value < allowed) {
            tighten.push(`${entry.file}: ${label} fell from ${allowed} to ${value}`);
          }
        }
      } else {
        if (allowed !== undefined) {
          tighten.push(`${entry.file}: ${label} no longer exceeds ${hard} (now ${value})`);
        }
        if (value > review) reviewable = true;
      }
    }
    if (reviewable && !baselined) warnings.push(entry.file);
  }
  for (const file of Object.keys(baseline).sort(byCodeUnit)) {
    if (!present.has(file)) tighten.push(`${file}: no longer exists`);
  }
  return { violations, tighten, warnings };
}

function listSources(repoRoot) {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      })
        .split("\0")
        .map((file) => file.replaceAll("\\", "/"))
        .filter(isHandwrittenSource),
    ),
  ].sort(byCodeUnit);
  const present = files.filter((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) {
      throw new Error(`assert-module-size: source symlink is unsupported: ${file}`);
    }
    return stat?.isFile() === true;
  });
  for (const area of REQUIRED_AREAS) {
    if (!present.some((file) => file.startsWith(area))) {
      throw new Error(`assert-module-size: source discovery omitted ${area}`);
    }
  }
  return present;
}

function scanModuleSizes(repoRoot) {
  return listSources(repoRoot).map((file) => {
    const buffer = readFileSync(resolve(repoRoot, file));
    return measureFile(file, buffer.toString("utf8"), buffer.length);
  });
}

function readBaseline(repoRoot) {
  let value;
  try {
    value = JSON.parse(readFileSync(resolve(repoRoot, BASELINE_PATH), "utf8"));
  } catch (error) {
    throw new Error(`assert-module-size: cannot read ${BASELINE_PATH}: ${error.message}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("assert-module-size: baseline must be a file-to-allowance object");
  }
  const baseline = {};
  for (const [file, allowance] of Object.entries(value)) {
    const keys =
      typeof allowance === "object" && allowance !== null && !Array.isArray(allowance)
        ? Object.keys(allowance)
        : [];
    const valid =
      isHandwrittenSource(file) &&
      !file.startsWith("/") &&
      !file.split("/").includes("..") &&
      keys.length > 0 &&
      keys.every(
        (key) =>
          (key === "lines" || key === "bytes") &&
          Number.isSafeInteger(allowance[key]) &&
          allowance[key] > 0,
      );
    if (!valid) throw new Error(`assert-module-size: invalid baseline entry: ${file}`);
    baseline[file] = { ...allowance };
  }
  return baseline;
}

function writeBaseline(repoRoot, baseline) {
  const rows = Object.entries(baseline)
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([file, allowance]) => {
      const fields = Object.entries(allowance).map(([key, value]) => `"${key}": ${value}`);
      return `  ${JSON.stringify(file)}: { ${fields.join(", ")} }`;
    });
  const text = rows.length === 0 ? "{}\n" : `{\n${rows.join(",\n")}\n}\n`;
  writeFileSync(resolve(repoRoot, BASELINE_PATH), text);
}

function seedBaseline(entries) {
  const baseline = {};
  for (const entry of entries) {
    const allowance = {};
    if (entry.lines > HARD_LINES) allowance.lines = entry.lines;
    if (entry.bytes > HARD_BYTES) allowance.bytes = entry.bytes;
    if (Object.keys(allowance).length > 0) baseline[entry.file] = allowance;
  }
  return baseline;
}

function pruneBaseline(entries, baseline) {
  const current = new Map(entries.map((entry) => [entry.file, entry]));
  const pruned = {};
  for (const [file, allowance] of Object.entries(baseline)) {
    const entry = current.get(file);
    if (entry === undefined) continue;
    const next = {};
    if (allowance.lines !== undefined && entry.lines > HARD_LINES) {
      next.lines = Math.min(allowance.lines, entry.lines);
    }
    if (allowance.bytes !== undefined && entry.bytes > HARD_BYTES) {
      next.bytes = Math.min(allowance.bytes, entry.bytes);
    }
    if (Object.keys(next).length > 0) pruned[file] = next;
  }
  return pruned;
}

/**
 * True when stale allowances are fatal. CI is the authority on the committed
 * tree; a local run only warns so a concurrent editor shrinking a file elsewhere
 * cannot block an unrelated commit.
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isStrictEnvironment(env = process.env) {
  const value = env.CI;
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

/**
 * Run the gate over a repository.
 * @param {string} repoRoot
 * @param {"verify"|"write"|"prune"} mode
 * @returns {{violations: string[], tighten: string[], warnings: string[], measured: number, baselined: number}}
 */
export function verifyModuleSize(repoRoot, mode = "verify") {
  const entries = scanModuleSizes(repoRoot);
  if (mode === "write") {
    const seeded = seedBaseline(entries);
    writeBaseline(repoRoot, seeded);
    return {
      violations: [],
      tighten: [],
      warnings: [],
      measured: entries.length,
      baselined: Object.keys(seeded).length,
    };
  }
  const baseline = readBaseline(repoRoot);
  const result = evaluateModuleSizes(entries, baseline);
  if (mode === "prune" && result.violations.length === 0 && result.tighten.length > 0) {
    writeBaseline(repoRoot, pruneBaseline(entries, baseline));
  }
  return { ...result, measured: entries.length, baselined: Object.keys(baseline).length };
}

function selfTest() {
  assert.equal(countLogicalLines("a.ts", "// c\n\nconst a = 1; // t\n/* b\n*/\n"), 1);
  assert.equal(countLogicalLines("a.ts", 'const u = "https://x.test//y";\n'), 1);
  assert.equal(countLogicalLines("a.ts", "const t = `\n// kept\n`;\n"), 3);
  assert.equal(isHandwrittenSource("packages/a/src/x.ts"), true);
  assert.equal(isHandwrittenSource("packages/a/src/x.generated.ts"), false);
  assert.equal(isHandwrittenSource("vendor/x/a.ts"), false);
  const file = (lines, bytes = 1) => [{ file: "a.ts", lines, bytes }];
  assert.equal(evaluateModuleSizes(file(HARD_LINES), {}).violations.length, 0);
  assert.equal(evaluateModuleSizes(file(HARD_LINES + 1), {}).violations.length, 1);
  assert.equal(evaluateModuleSizes(file(1, HARD_BYTES + 1), {}).violations.length, 1);
  const allowed = { "a.ts": { lines: 900 } };
  assert.equal(evaluateModuleSizes(file(900), allowed).violations.length, 0);
  assert.equal(evaluateModuleSizes(file(901), allowed).violations.length, 1);
  assert.equal(evaluateModuleSizes(file(800), allowed).tighten.length, 1);
  assert.equal(evaluateModuleSizes(file(HARD_LINES), allowed).tighten.length, 1);
  assert.equal(evaluateModuleSizes([], allowed).tighten.length, 1);
  assert.deepEqual(evaluateModuleSizes(file(REVIEW_LINES + 1), {}).warnings, ["a.ts"]);
  console.log("assert-module-size: self-test ok");
}

function parseArgs(argv) {
  const options = { root: resolve(import.meta.dirname, ".."), mode: "verify", strict: false };
  let verbose = false;
  let selfTestRequested = false;
  const modes = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      const value = argv[(index += 1)];
      if (value === undefined) throw new Error("--root needs a directory");
      options.root = resolve(value);
    } else if (arg === "--write" || arg === "--update-baseline") modes.push("write");
    else if (arg === "--prune") modes.push("prune");
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--verbose") verbose = true;
    else if (arg === "--self-test") selfTestRequested = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (modes.length > 1) throw new Error("--write and --prune are mutually exclusive");
  if (modes.length === 1) options.mode = modes[0];
  return { ...options, verbose, selfTest: selfTestRequested };
}

function main() {
  const usage =
    "Usage: node scripts/assert-module-size.mjs [--root <dir>] [--verbose] [--write|--update-baseline|--prune] [--strict] [--self-test]";
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`assert-module-size: ${error.message}\n${usage}`);
    process.exitCode = 1;
    return;
  }
  if (options.selfTest) {
    selfTest();
    return;
  }
  try {
    const strict = options.strict || isStrictEnvironment();
    const result = verifyModuleSize(options.root, options.mode);
    if (options.mode === "write") {
      console.log(
        `assert-module-size: baseline written with ${result.baselined} oversize files (of ${result.measured} measured).`,
      );
      return;
    }
    if (result.violations.length > 0) {
      console.error(
        `assert-module-size: ${result.violations.length} module(s) break the size policy ` +
          `(hard limit ${HARD_LINES} logical lines / ${HARD_BYTES} bytes). Split by responsibility ` +
          "(RULES.md, Module size); do not raise the baseline.\n" +
          result.violations.map((line) => `  ${line}`).join("\n"),
      );
      process.exitCode = 1;
      return;
    }
    const shown = options.verbose ? result.warnings : result.warnings.slice(0, WARN_PREVIEW);
    if (result.warnings.length > 0) {
      console.warn(
        `assert-module-size: ${result.warnings.length} file(s) exceed the review threshold ` +
          `(${REVIEW_LINES} logical lines / ${WARN_BYTES} bytes); advisory only.\n` +
          shown.map((file) => `  ${file}`).join("\n") +
          (shown.length < result.warnings.length
            ? `\n  ... ${result.warnings.length - shown.length} more (--verbose lists all)`
            : ""),
      );
    }
    if (result.tighten.length > 0 && options.mode !== "prune") {
      const message =
        "assert-module-size: baseline allowances can be tightened; run " +
        "`node scripts/assert-module-size.mjs --prune`.\n" +
        result.tighten.map((line) => `  ${line}`).join("\n");
      if (strict) {
        console.error(message);
        process.exitCode = 1;
        return;
      }
      console.warn(message);
    }
    console.log(
      `assert-module-size: ok (${result.measured} files measured, ${result.baselined} grandfathered).`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) main();
