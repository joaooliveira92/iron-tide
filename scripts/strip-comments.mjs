#!/usr/bin/env node
// Strips code comments from .ts and .tsx files. Comments come from the
// parser, so string, template, and regex contents are never touched. A file is
// rewritten only when its syntax tree with comments ignored is identical before
// and after; a comment whose removal changes the tree is retained and reported.
// Comments a tool reads (directives, licence lines, triple-slash references,
// pragmas, @deprecated) are kept.
//
// Usage: pnpm strip:comments --scope <path> [--scope <path> ...]
//          [--apply] [--check] [--report <file>]
//   (default)  dry run: report what would be removed
//   --apply    write every verified file atomically, rolling back on failure
//   --check    exit 1 while any removable comment remains
// Exit codes: 0 ok, 1 findings or unparsable file, 2 usage, 3 I/O.
import { parseSync } from "oxc-parser";
import * as nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CliError,
  EXIT,
  SKIP_DIRS,
  commitChanges,
  resolveScope,
} from "./sweep-comments-engine.mjs";

export const SCHEMA_VERSION = 1;
const EXTS = new Set([".ts", ".tsx"]);
const byCodepoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const KEEP_RULES = [
  [
    "triple-slash",
    (c) => c.type === "Line" && /^\/\s*<(reference|amd-module|amd-dependency)\b/.test(c.value),
  ],
  [
    "licence",
    (c) =>
      c.value.startsWith("!") ||
      /@license|@preserve|SPDX-License-Identifier|copyright|\(c\)/i.test(c.value),
  ],
  ["ts-directive", (c) => /^\s*@ts-(expect-error|ignore|nocheck|check)\b/.test(c.value)],
  [
    "lint-directive",
    (c) =>
      /^\s*(eslint|oxlint|biome|prettier|istanbul|c8|v8)[\s-]*(disable|enable|ignore)/i.test(
        c.value,
      ),
  ],
  [
    "tool-pragma",
    (c) =>
      /@(vitest-environment|jsx|jsxImportSource|jsxFrag|jsxRuntime|vite-ignore|refresh)\b|[#@]__(PURE|NO_SIDE_EFFECTS)__/.test(
        c.value,
      ),
  ],
  ["deprecated", (c) => /@deprecated\b/.test(c.value)],
  ["test-focus-allow-skip", (c) => /test-focus-allow-skip:\s*\S/.test(c.value)],
];

export const keepReason = (comment) => KEEP_RULES.find(([, test]) => test(comment))?.[0] ?? null;

const SKIP_KEYS = new Set(["start", "end", "range", "loc", "parent"]);

function cleanJsxText(value) {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((line, i) => {
    if (/[^ \t]/.test(line)) lastNonEmpty = i;
  });
  let out = "";
  lines.forEach((line, i) => {
    let text = line.replaceAll("\t", " ");
    if (i !== 0) text = text.replace(/^ +/, "");
    if (i !== lines.length - 1) text = text.replace(/ +$/, "");
    if (text) out += i === lastNonEmpty ? text : `${text} `;
  });
  return out;
}

function normalizeJsx(node) {
  const out = {};
  for (const key of Object.keys(node).toSorted()) {
    if (!SKIP_KEYS.has(key) && key !== "children") out[key] = normalize(node[key]);
  }
  const children = [];
  for (const child of node.children ?? []) {
    if (child.type === "JSXText") {
      const text = cleanJsxText(child.value);
      if (!text) continue;
      if (typeof children.at(-1) === "string") children[children.length - 1] += text;
      else children.push(text);
    } else if (
      child.type === "JSXExpressionContainer" &&
      child.expression.type === "JSXEmptyExpression"
    ) {
      continue;
    } else {
      children.push(normalize(child));
    }
  }
  out.children = children;
  return out;
}

function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node === null || typeof node !== "object") return node;
  if (node.type === "JSXElement" || node.type === "JSXFragment") return normalizeJsx(node);
  const out = {};
  for (const key of Object.keys(node).toSorted()) {
    if (!SKIP_KEYS.has(key)) out[key] = normalize(node[key]);
  }
  return out;
}

function emptyJsxContainers(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) emptyJsxContainers(child, out);
  } else if (node !== null && typeof node === "object") {
    if (node.type === "JSXExpressionContainer" && node.expression.type === "JSXEmptyExpression") {
      out.push({ start: node.start, end: node.end });
    }
    for (const key of Object.keys(node)) emptyJsxContainers(node[key], out);
  }
  return out;
}

const fingerprint = (program) =>
  JSON.stringify(normalize(program), (_key, value) =>
    typeof value === "bigint" ? `${String(value)}n` : value,
  );

const parse = (rel, src) => parseSync(rel, src, { lang: rel.endsWith(".tsx") ? "tsx" : "ts" });

const isBlank = (text) => text.trim() === "";
const lineBounds = (text, from, to) => {
  const start = text.lastIndexOf("\n", from - 1) + 1;
  const newline = text.indexOf("\n", to);
  return { start, end: newline === -1 ? text.length : newline };
};

function removeComment(text, start, end) {
  const line = lineBounds(text, start, end);
  const before = text.slice(line.start, start);
  const after = text.slice(end, line.end).replace(/\r$/, "");
  if (isBlank(before) && isBlank(after)) {
    const previousBlank =
      line.start === 0 ||
      isBlank(text.slice(lineBounds(text, line.start - 1, line.start - 1).start, line.start - 1));
    let from = line.start;
    const terminated = line.end < text.length;
    let to = terminated ? line.end + 1 : line.end;
    if (!terminated && from > 0) from -= text[from - 2] === "\r" ? 2 : 1;
    const next = lineBounds(text, to, to);
    if (previousBlank && to < text.length && isBlank(text.slice(next.start, next.end))) {
      to = Math.min(next.end + 1, text.length);
    }
    return text.slice(0, from) + text.slice(to);
  }
  if (isBlank(before)) {
    let to = end;
    while (text[to] === " " || text[to] === "\t") to += 1;
    return text.slice(0, start) + text.slice(to);
  }
  let from = start;
  while (text[from - 1] === " " || text[from - 1] === "\t") from -= 1;
  let result = text.slice(0, from) + text.slice(end);
  if (/[\w$]/.test(result[from - 1] ?? "") && /[\w$]/.test(result[from] ?? "")) {
    result = `${result.slice(0, from)} ${result.slice(from)}`;
  }
  return result;
}

const applyRemovals = (src, ranges) =>
  ranges
    .toSorted((a, b) => b.start - a.start)
    .reduce((text, r) => removeComment(text, r.start, r.end), src);

const verifies = (rel, out, expected) => {
  const result = parse(rel, out);
  return result.errors.length === 0 && fingerprint(result.program) === expected;
};

/**
 * Pure: strip one file. Returns the new text, what was removed, and what stayed.
 * @param {string} rel
 * @param {string} src
 */
export function stripSource(rel, src) {
  const parsed = parse(rel, src);
  if (parsed.errors.length > 0)
    return {
      status: "unparsable",
      out: src,
      removed: 0,
      kept: {},
      retained: 0,
      error: parsed.errors[0].message,
    };
  const kept = {};
  const removable = [];
  const containers = emptyJsxContainers(parsed.program);
  for (const c of parsed.comments) {
    const reason = keepReason(c);
    if (reason) {
      kept[reason] = (kept[reason] ?? 0) + 1;
      continue;
    }
    const container = containers.find((box) => box.start <= c.start && c.end <= box.end);
    removable.push({
      variants: container
        ? [container, { start: c.start, end: c.end }]
        : [{ start: c.start, end: c.end }],
    });
  }
  if (removable.length === 0) return { status: "clean", out: src, removed: 0, kept, retained: 0 };
  const expected = fingerprint(parsed.program);
  const all = applyRemovals(
    src,
    removable.map((r) => r.variants[0]),
  );
  if (verifies(rel, all, expected))
    return { status: "stripped", out: all, removed: removable.length, kept, retained: 0 };
  const accepted = [];
  for (const r of removable.toReversed()) {
    const variant = r.variants.find((v) =>
      verifies(rel, applyRemovals(src, [...accepted, v]), expected),
    );
    if (variant) accepted.push(variant);
  }
  const out = accepted.length ? applyRemovals(src, accepted) : src;
  return {
    status: accepted.length ? "stripped" : "clean",
    out,
    removed: accepted.length,
    kept,
    retained: removable.length - accepted.length,
  };
}

function listFiles(fs, dir, out) {
  for (const name of fs.readdirSync(dir).toSorted()) {
    const full = path.join(dir, name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name)) listFiles(fs, full, out);
    } else if (EXTS.has(path.extname(name))) {
      out.push(full);
    }
  }
}

export function parseArgs(argv) {
  const opts = { scopes: [], apply: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--check") opts.check = true;
    else if (arg === "--scope" || arg === "--report") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--"))
        throw new CliError(EXIT.USAGE, `${arg} needs a value`);
      if (arg === "--scope") opts.scopes.push(value);
      else if (opts.report) throw new CliError(EXIT.USAGE, "duplicate --report");
      else opts.report = value;
    } else throw new CliError(EXIT.USAGE, `unknown argument: ${arg}`);
  }
  if (opts.scopes.length === 0) throw new CliError(EXIT.USAGE, "--scope is required");
  if (opts.apply && opts.check) throw new CliError(EXIT.USAGE, "--apply and --check are exclusive");
  return opts;
}

/**
 * Run the stripper. Returns the exit code; never calls process.exit.
 * @param {string[]} argv
 * @param {{ repoRoot: string, fs?: typeof nodeFs, stderr?: (s: string) => void }} env
 */
export function runCli(argv, env) {
  const fs = env.fs ?? nodeFs;
  const err = env.stderr ?? ((s) => process.stderr.write(s));
  try {
    const opts = parseArgs(argv);
    const files = new Map();
    let realRoot = env.repoRoot;
    for (const scope of opts.scopes) {
      const resolved = resolveScope(env.repoRoot, scope, fs);
      realRoot = resolved.realRoot;
      const found = [];
      if (fs.lstatSync(resolved.realScope).isDirectory()) listFiles(fs, resolved.realScope, found);
      else if (EXTS.has(path.extname(resolved.realScope))) found.push(resolved.realScope);
      for (const abs of found) files.set(abs, true);
    }
    const results = [];
    const changes = [];
    for (const abs of [...files.keys()].toSorted(byCodepoint)) {
      const rel = path.relative(realRoot, abs).split(path.sep).join("/");
      const original = fs.readFileSync(abs);
      const result = stripSource(rel, original.toString("utf8"));
      results.push({
        path: rel,
        status: result.status,
        removed: result.removed,
        retained: result.retained,
        kept: result.kept,
        error: result.error,
      });
      if (result.status === "stripped")
        changes.push({
          abs,
          rel,
          original,
          content: Buffer.from(result.out, "utf8"),
          mode: fs.statSync(abs).mode,
          removed: result.removed,
        });
    }
    const unparsable = results.filter((r) => r.status === "unparsable");
    const totals = {
      files: results.length,
      filesWithRemovals: changes.length,
      removed: 0,
      retained: 0,
      unparsable: unparsable.length,
      kept: {},
    };
    for (const r of results) {
      totals.removed += r.removed;
      totals.retained += r.retained;
      for (const [reason, n] of Object.entries(r.kept))
        totals.kept[reason] = (totals.kept[reason] ?? 0) + n;
    }
    totals.kept = Object.fromEntries(
      Object.entries(totals.kept).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    );
    if (opts.report) {
      const body = {
        schemaVersion: SCHEMA_VERSION,
        scopes: opts.scopes.toSorted(byCodepoint),
        totals,
        files: results.filter((r) => r.status !== "clean" || r.retained > 0),
      };
      fs.writeFileSync(path.resolve(opts.report), `${JSON.stringify(body, null, 2)}\n`);
    }
    for (const r of unparsable) err(`unparsable: ${r.path}: ${r.error}\n`);
    if (unparsable.length > 0)
      throw new CliError(EXIT.VALIDATION, "refusing to continue with unparsable files");
    if (opts.apply && changes.length > 0) commitChanges(changes, fs);
    err(
      `${opts.apply ? "removed" : "would remove"} ${String(totals.removed)} comment(s) in ${String(changes.length)} of ${String(totals.files)} file(s); ` +
        `retained ${String(totals.retained)} (changes meaning); kept ${JSON.stringify(totals.kept)}\n`,
    );
    if (opts.check && totals.removed > 0) {
      const offenders = results.filter((r) => r.removed > 0).slice(0, 10);
      err(
        `Error: ${String(totals.removed)} comment(s) found. Code carries no comments; ` +
          "delete them or run `pnpm strip:comments --scope <path> --apply`.\n" +
          offenders.map((r) => `  ${r.path}: ${String(r.removed)}\n`).join(""),
      );
      return EXIT.VALIDATION;
    }
    return EXIT.OK;
  } catch (e) {
    if (e instanceof CliError) {
      err(`Error: ${e.message}\n`);
      return e.exitCode;
    }
    err(`strip-comments: internal error: ${e instanceof Error ? e.message : String(e)}\n`);
    return EXIT.IO;
  }
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return (
      nodeFs.realpathSync(fileURLToPath(import.meta.url)) ===
      nodeFs.realpathSync(path.resolve(process.argv[1]))
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = runCli(process.argv.slice(2), {
    repoRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  });
}
