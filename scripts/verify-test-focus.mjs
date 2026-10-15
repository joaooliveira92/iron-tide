#!/usr/bin/env node
// Fail on focused tests and unexplained skipped tests.
//
// `.only` on CI silently drops every other test in the file — a green run that
// proves almost nothing. `.skip` is legitimate (an environment-gated suite) but
// must be explained, so a bare `.skip` is treated as debt the same way an
// unclassified deferral is. An admitted skip carries a same-line or
// immediately-preceding comment:
//
//   const describeIf = hasElectron ? describe : describe.skip; // test-focus-allow-skip: Electron optional outside e2e
//
// A whole file opts out of the scan (used only by this gate's own fixtures,
// whose source necessarily contains the tokens):
//
//   // test-focus-scan-ignore-file: <reason>
//
// Wired into `pnpm preflight`. Standalone: `node scripts/verify-test-focus.mjs`.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const TEST_FILE_RE = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/u;
const EXCLUDED = ["vendor/", "repos/", "prototype/", "node_modules/", "dist/"];
const AREAS = ["packages/", "apps/", "scripts/"];

/** @param {string} file */
export function isTestFile(file) {
  return (
    TEST_FILE_RE.test(file) &&
    !EXCLUDED.some((prefix) => file.split("/").includes(prefix.replace(/\/$/u, ""))) &&
    AREAS.some((prefix) => file.startsWith(prefix))
  );
}

const FOCUS_RE = /\b(?:describe|it|test|context|suite)\.only\b|(?:^|[^\w.])\.only\s*\(/u;
const SKIP_RE =
  /\b(?:describe|it|test|context|suite)\.skip\b|\bx(?:describe|it|test)\b|(?:^|[^\w.])\.skip\s*\(/u;
const ALLOW_RE = /test-focus-allow-skip:\s*\S/u;
const IGNORE_FILE_RE = /test-focus-scan-ignore-file:\s*\S/u;

/** Strip a trailing line comment so tokens in prose are not flagged. */
function codeOf(line) {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.slice(0, idx);
}

/**
 * @typedef {{ line: number, text: string, allowed: boolean }} Hit
 * @typedef {{ focuses: Hit[], skips: Hit[] }} Scan
 */

/**
 * Scan one source string. Pure; no filesystem. Exported for the fixtures.
 * @param {string} text
 * @returns {Scan}
 */
export function scanTestSource(text) {
  const lines = text.split("\n");
  /** @type {Hit[]} */ const focuses = [];
  /** @type {Hit[]} */ const skips = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const code = codeOf(line);
    const allowed = ALLOW_RE.test(line) || (i > 0 && ALLOW_RE.test(lines[i - 1]));
    if (FOCUS_RE.test(code)) focuses.push({ line: i + 1, text: line.trim(), allowed });
    if (SKIP_RE.test(code)) skips.push({ line: i + 1, text: line.trim(), allowed });
  }
  return { focuses, skips };
}

/**
 * Collect problems for one file. Empty when clean or file-ignored.
 * @param {string} file
 * @param {string} text
 * @returns {string[]}
 */
export function collectProblems(file, text) {
  if (IGNORE_FILE_RE.test(text)) return [];
  const { focuses, skips } = scanTestSource(text);
  const problems = [];
  for (const f of focuses) problems.push(`${file}:${f.line} focused test (.only): ${f.text}`);
  for (const s of skips)
    if (!s.allowed)
      problems.push(
        `${file}:${s.line} unexplained skip (add "// test-focus-allow-skip: <reason>"): ${s.text}`,
      );
  return problems;
}

function trackedTestFiles() {
  return (
    execFileSync("git", ["ls-files", "*.test.*", "*.spec.*"], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .filter(isTestFile)
      // Skip a tracked test deleted in the worktree but not yet staged: there is no test to scan.
      .filter((file) => existsSync(resolve(root, file)))
  );
}

function main() {
  const files = trackedTestFiles();
  const problems = [];
  for (const file of files) {
    problems.push(...collectProblems(file, readFileSync(resolve(root, file), "utf8")));
  }
  if (problems.length > 0) {
    console.error("verify-test-focus: FAILED\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      '\nA skipped test must state why ("// test-focus-allow-skip: <reason>"); a focused\n' +
        "test must never be committed (.only). See scripts/verify-test-focus.mjs.",
    );
    process.exit(1);
  }
  console.log(`verify-test-focus: ok (${files.length} test files, no focus, no unexplained skip)`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
