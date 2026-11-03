#!/usr/bin/env node
// Reject NEW assertions to `unknown` while retiring the recorded existing ones.
//
// `as unknown as T` (and `<unknown>T`, and `unknown` members of asserted unions)
// erase type information at exactly the boundary this codebase works hardest to
// keep honest, so the gate freezes the current inventory as a ratchet: the count
// may only fall. A baseline entry is keyed by file + a syntax fingerprint of the
// asserted type (whitespace-normalised, comments excluded), so the same assertion
// in two places counts twice and a rewritten one is treated as new.
//
// Adapted from deepseek-harness `scripts/verify-no-unknown-casts.ts` (AST walk
// retargeted to oxc-parser).
//
// Usage: `node scripts/verify-no-unknown-casts.mjs [--write|--prune]`
//   (default)  fail on any new assertion or stale baseline entry
//   --write    (re)seed the baseline from the current tree (accepts current debt)
//   --prune    delete stale entries after establishing no new assertion exists
//
// Wired into `pnpm preflight`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync } from "oxc-parser";

const root = resolve(import.meta.dirname, "..");
const BASELINE_PATH = "scripts/no-unknown-casts.baseline.json";

// Authored-source areas the gate owns. A run that finds none of an area is a
// discovery bug, not a clean tree, so it fails loudly.
const AREAS = ["packages/", "apps/", "scripts/"];
const EXCLUDED = ["vendor/", "repos/", "prototype/"];

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;

function isSource(file) {
  return (
    SOURCE_RE.test(file) &&
    !EXCLUDED.some((prefix) => file.startsWith(prefix)) &&
    AREAS.some((prefix) => file.startsWith(prefix))
  );
}

function normalize(text) {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * True for a type that asserts to `unknown`, including angle syntax and any
 * `unknown` member of a union.
 * @param {object} type - an oxc TypeNode.
 * @returns {boolean}
 */
function assertsUnknown(type) {
  if (type === null || typeof type !== "object") return false;
  if (type.type === "TSParenthesizedType") return assertsUnknown(type.typeAnnotation);
  if (type.type === "TSUnknownKeyword") return true;
  if (type.type === "TSUnionType") return type.types.some(assertsUnknown);
  return false;
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/**
 * Find assertions to `unknown` in one source file, in source order.
 * @param {string} file - repository-relative path (forward slashes).
 * @param {string} text - source contents.
 * @returns {Array<{file: string, line: number, fingerprint: string}>}
 */
export function findUnknownCasts(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const { program, errors } = parseSync(normalized, text);
  if (errors.length > 0) {
    throw new Error(
      `verify-no-unknown-casts: cannot parse ${normalized}: ${errors[0].message} ` +
        "(failing closed — an unparsed file could hide an assertion)",
    );
  }
  const casts = [];
  const visit = (node) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node.type !== "string") return;
    if (
      (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
      assertsUnknown(node.typeAnnotation)
    ) {
      const type = node.typeAnnotation;
      const fingerprint = createHash("sha256")
        .update(normalize(text.slice(type.start, type.end)))
        .digest("hex");
      casts.push({ file: normalized, line: lineAt(text, type.start), fingerprint });
    }
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "start" || key === "end" || key === "range") continue;
      const value = node[key];
      if (value !== null && typeof value === "object") visit(value);
    }
  };
  visit(program);
  return casts;
}

/**
 * Scan all authored source under the owned areas (tracked + untracked, git-ignored
 * excluded), guarding against an empty or narrowed corpus.
 * @param {string} repoRoot
 * @returns {Array<{file: string, line: number, fingerprint: string}>}
 */
export function scanUnknownCasts(repoRoot) {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      })
        .split("\0")
        .map((file) => file.replaceAll("\\", "/"))
        .filter(isSource),
    ),
  ].sort();

  const present = files.filter((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink())
      throw new Error(`verify-no-unknown-casts: source symlink is unsupported: ${file}`);
    return stat?.isFile() === true;
  });

  for (const area of AREAS) {
    if (!present.some((file) => file.startsWith(area))) {
      throw new Error(`verify-no-unknown-casts: source discovery omitted ${area}`);
    }
  }

  return present.flatMap((file) =>
    findUnknownCasts(file, readFileSync(resolve(repoRoot, file), "utf8")),
  );
}

/**
 * Count assertions per file and fingerprint, in stable order. Ordering is by
 * code unit (`<`), not `localeCompare`, so the written baseline is byte-identical
 * across machines and locales.
 * @param {ReadonlyArray<{file: string, fingerprint: string}>} casts
 * @returns {Record<string, Record<string, number>>}
 */
export function countUnknownCasts(casts) {
  const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const baseline = {};
  for (const { file, fingerprint } of casts) {
    const counts = (baseline[file] ??= {});
    counts[fingerprint] = (counts[fingerprint] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(baseline)
      .sort(([a], [b]) => byCodeUnit(a, b))
      .map(([file, counts]) => [
        file,
        Object.fromEntries(Object.entries(counts).sort(([a], [b]) => byCodeUnit(a, b))),
      ]),
  );
}

function readBaseline(repoRoot) {
  let value;
  try {
    value = JSON.parse(readFileSync(resolve(repoRoot, BASELINE_PATH), "utf8"));
  } catch (error) {
    throw new Error(`verify-no-unknown-casts: cannot read ${BASELINE_PATH}: ${error.message}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("verify-no-unknown-casts: baseline must be a file-to-counts object");
  }
  const baseline = {};
  for (const [file, counts] of Object.entries(value)) {
    if (
      !isSource(file) ||
      file.startsWith("/") ||
      file.includes("\\") ||
      file.split("/").includes("..") ||
      typeof counts !== "object" ||
      counts === null ||
      Array.isArray(counts) ||
      Object.keys(counts).length === 0
    ) {
      throw new Error(`verify-no-unknown-casts: invalid baseline file: ${file}`);
    }
    const parsed = {};
    for (const [fingerprint, count] of Object.entries(counts)) {
      if (!/^[a-f0-9]{64}$/u.test(fingerprint) || !Number.isSafeInteger(count) || count <= 0) {
        throw new Error(`verify-no-unknown-casts: invalid baseline count: ${file}:${fingerprint}`);
      }
      parsed[fingerprint] = count;
    }
    baseline[file] = parsed;
  }
  return baseline;
}

function writeBaseline(repoRoot, baseline) {
  writeFileSync(resolve(repoRoot, BASELINE_PATH), `${JSON.stringify(baseline, null, 2)}\n`);
}

/**
 * True when the run should treat retired baseline entries as fatal. CI is the
 * authority on the committed tree, so it is strict; a local run only warns,
 * because a concurrent editor retiring casts elsewhere must not block an
 * unrelated commit. `--strict` opts a local run in.
 * @returns {boolean}
 */
export function isStrictEnvironment(env = process.env) {
  const value = env.CI;
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

/**
 * Enforce the recorded assertion inventory.
 * @param {string} repoRoot
 * @param {"verify"|"write"|"prune"} mode
 * @param {boolean} strict - treat retired (stale) entries as fatal.
 * @returns {number} the number of assertions observed.
 * @throws on new assertions or malformed inventory, and on stale entries when strict.
 */
export function verifyNoUnknownCasts(repoRoot, mode = "verify", strict = false) {
  const casts = scanUnknownCasts(repoRoot);
  const current = countUnknownCasts(casts);

  if (mode === "write") {
    writeBaseline(repoRoot, current);
    return casts.length;
  }

  const baseline = readBaseline(repoRoot);
  const remaining = structuredClone(baseline);
  const added = [];
  for (const cast of casts) {
    const counts = remaining[cast.file];
    const allowance = counts?.[cast.fingerprint] ?? 0;
    if (counts !== undefined && allowance > 0) counts[cast.fingerprint] = allowance - 1;
    else added.push(cast);
  }
  if (added.length > 0) {
    throw new Error(
      "verify-no-unknown-casts: new assertions to unknown are forbidden. Use a typed value or narrow the input.\n" +
        added.map((cast) => `  ${cast.file}:${String(cast.line)} (${cast.fingerprint})`).join("\n"),
    );
  }
  const stale = Object.entries(remaining).flatMap(([file, counts]) =>
    Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([fingerprint]) => `  ${file} (${fingerprint})`),
  );
  if (stale.length > 0) {
    if (mode === "prune") {
      writeBaseline(repoRoot, current);
    } else if (strict) {
      throw new Error(
        "verify-no-unknown-casts: remove retired baseline entries with `node scripts/verify-no-unknown-casts.mjs --prune`.\n" +
          stale.join("\n"),
      );
    } else {
      console.warn(
        `verify-no-unknown-casts: ${stale.length} retired baseline entr${stale.length === 1 ? "y" : "ies"} ` +
          "(casts removed since the baseline). Run with `--prune` to tighten; CI enforces this.",
      );
    }
  }
  return casts.length;
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    const mode = args.includes("--write") ? "write" : args.includes("--prune") ? "prune" : "verify";
    const strict = args.includes("--strict") || isStrictEnvironment();
    const known = new Set(["--write", "--prune", "--strict"]);
    const extra = args.filter((arg) => !known.has(arg));
    if (extra.length > 0 || (args.includes("--write") && args.includes("--prune"))) {
      throw new Error(
        "Usage: node scripts/verify-no-unknown-casts.mjs [--write|--prune] [--strict]",
      );
    }
    const count = verifyNoUnknownCasts(root, mode, strict);
    if (mode === "write") {
      console.log(
        `verify-no-unknown-casts: baseline written with ${String(count)} existing assertions.`,
      );
    } else {
      console.log(
        `verify-no-unknown-casts: no new assertions; ${String(count)} existing assertions remain.`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
