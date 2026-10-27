#!/usr/bin/env node
// Deterministic comment-sweep lever (ADR-0106/0107). It removes three
// unambiguous mechanical classes of redundant comment from the authored tree:
//
//   1. self-path file headers on line 1 (the path is the file's identity)
//   2. banner/ruler separators whose label is a short token-free noun phrase
//   3. JSX narration comments (`{/* label */}`) that carry no design token
//
// Judgment cases are deliberately left alone: any label or doc that carries a
// design token (DESIGN-*/ADR-*/a section ref/AC-*/ticket), prose that states a
// why, commented-out code, and name-only JSDoc that adds a unit or provenance.
// The classification is a pure function of the file text, so two runs on the
// same tree are byte-identical and a second run is a no-op (idempotent).
//
// The bare invocation is a non-writing inspection. Any write goes through the
// reviewed-report workflow below. This is a manual tool: it is not wired into
// `pnpm check` or `preflight`.
//
// Usage: pnpm sweep:comments
//
// Report-first mode (any of --apply, --scope, --rule, --report, --format,
// --review, --decision, --id, --fail-on-candidate) routes to
// sweep-comments-engine.mjs. It classifies candidates into a deterministic JSON
// report, and --apply acts only on an explicitly reviewed report. Exit codes:
// 0 ok, 1 validation, 2 usage, 3 I/O.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isEntryPoint, repoRelativePath } from "./lib/paths.mjs";
import { NEW_FLAGS, runCli } from "./sweep-comments-engine.mjs";

const ROOTS = ["packages", "apps", "scripts"];
const EXTS = new Set([".ts", ".tsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", "vendor", "repos"]);
const TOKEN = /(DESIGN|ADR|§|AC-|INC|BW-|SPM|SB3-|CAH-|MIG-|IMP-|\bticket\b|\bspec\b|TDD|\d)/;
const DENY = /(drift|legacy|deprecat|intentional|temporary|fallback|hack|workaround|migrat)/i;

const SELF = /^\/\/ ?(packages|apps)\/[\w./-]+\.(ts|tsx|mjs|cjs)$/;
const SELF_SUFFIX = /^\/\/ ?(packages|apps)\/[\w./-]+\.(ts|tsx|mjs|cjs)\s+-\s+(.+)$/;
const RULER = /^(\s*)\/\/\s*-{3,}\s*(.*)$/;
const JSX = /^\s*\{\/\*\s*(.*?)\s*\*\/\}\s*$/;

/**
 * A ruler or JSX label is removable only when it is a short noun phrase with no
 * design token, no punctuation, and no rationale word. Everything else is kept.
 * @param {string} label
 * @returns {boolean}
 */
export function safeLabel(label) {
  const l = label.replace(/-{2,}\s*$/, "").trim();
  if (l.length === 0) return false;
  if (/[():;,."'!?]/.test(l)) return false;
  if (TOKEN.test(l)) return false;
  if (DENY.test(l)) return false;
  const words = l.split(/\s+/);
  if (words.length > 4) return false;
  if (!words.every((w) => /^[A-Za-z][A-Za-z-]*$/.test(w))) return false;
  return true;
}

/**
 * Classify one file's source. Pure: same input, same removals. Returns the
 * removals (1-based line numbers and the verbatim line) and the rewritten text.
 * @param {string} src
 * @returns {{ removals: {line: number, kind: string, text: string}[], out: string }}
 */
export function sweepSource(src) {
  const lines = src.split("\n");
  const drop = new Set();
  const replace = new Map();
  const removals = [];

  let i0 = 0;
  if (lines[0] && lines[0].startsWith("#!")) i0 = 1;
  const first = lines[i0] !== undefined ? lines[i0].replace(/^\ufeff/, "") : undefined;
  if (first !== undefined) {
    if (SELF.test(first)) {
      drop.add(i0);
      removals.push({ line: i0 + 1, kind: "HEADER", text: lines[i0] });
    } else {
      const m = SELF_SUFFIX.exec(first);
      if (m) {
        replace.set(i0, `// ${m[3]}`);
        removals.push({ line: i0 + 1, kind: "HEADER-TRIM", text: lines[i0] });
      }
    }
  }

  for (let i = i0; i < lines.length; i++) {
    const r = RULER.exec(lines[i]);
    if (r && safeLabel(r[2])) {
      drop.add(i);
      removals.push({ line: i + 1, kind: "RULER", text: lines[i] });
      continue;
    }
    const j = JSX.exec(lines[i]);
    if (j && safeLabel(j[1])) {
      drop.add(i);
      removals.push({ line: i + 1, kind: "JSX", text: lines[i] });
    }
  }

  const out = lines
    .map((l, i) => (replace.has(i) ? replace.get(i) : l))
    .filter((_, i) => !drop.has(i))
    .join("\n");
  return { removals, out };
}

function walk(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (EXTS.has(path.extname(name))) {
      out.push(full);
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.some((a) => NEW_FLAGS.includes(a))) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    process.exitCode = runCli(argv, { repoRoot: root });
    return;
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = [];
  for (const root of ROOTS) walk(path.join(repoRoot, root), files);
  files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const counts = { HEADER: 0, "HEADER-TRIM": 0, RULER: 0, JSX: 0 };
  let touched = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const { removals } = sweepSource(src);
    if (removals.length === 0) continue;
    touched++;
    for (const r of removals) {
      counts[r.kind]++;
      console.log(`${r.kind}\t${repoRelativePath(repoRoot, file)}:${r.line}\t${r.text.trim()}`);
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const detail = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(" ");
  console.error(`\nDRY RUN: files=${touched} total=${total} ${detail}`.trimEnd());
}

if (isEntryPoint(import.meta.url)) main();
