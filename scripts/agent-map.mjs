#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import { isEntryPoint } from "./lib/paths.mjs";
import { discoverWorkspaces, toPosix, workspaceForPath } from "./lib/workspaces.mjs";

export const FORMAT_VERSION = 1;
const MAX_BUFFER = 32 * 1024 * 1024;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const SOURCE_ROOTS = ["packages", "apps", "content", "scripts"];
const USAGE = "usage: pnpm agent:map <symbol-or-path> [--json] [--limit N] [--help]";

export class MapError extends Error {
  constructor(message, code, details = []) {
    super(message);
    this.name = "MapError";
    this.code = code;
    this.details = details;
  }
}

export function parseArguments(argv) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        limit: { type: "string", default: "8" },
      },
    }));
  } catch (error) {
    throw new MapError(`${error.message}\n${USAGE}`, 2);
  }
  if (values.help) return { help: true };
  if (positionals.length !== 1) throw new MapError(USAGE, 2);
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new MapError("--limit must be an integer between 1 and 50", 2);
  }
  return { help: false, query: positionals[0], json: values.json, limit };
}

export function gitText(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.status === 1) return "";
    const detail = (error.stderr ?? error.message ?? "").toString().trim();
    throw new MapError(`git ${args[0]} failed: ${detail}`, 2);
  }
}

export function parseGrep(output) {
  const hits = [];
  for (const line of output.split("\n")) {
    if (line === "") continue;
    const first = line.indexOf(":");
    const second = line.indexOf(":", first + 1);
    if (first < 1 || second < first) continue;
    const lineNumber = Number(line.slice(first + 1, second));
    if (!Number.isInteger(lineNumber)) continue;
    hits.push({
      path: line.slice(0, first),
      line: lineNumber,
      text: line.slice(second + 1).trim(),
    });
  }
  return hits;
}

function symbolHits(root, symbol, pattern) {
  const output = gitText(root, ["grep", "-n", "-I", "-E", "-e", pattern, "--", ...SOURCE_ROOTS]);
  return parseGrep(output);
}

function definitionPattern(symbol) {
  return (
    "^[[:space:]]*(export[[:space:]]+)?(declare[[:space:]]+)?(async[[:space:]]+)?" +
    `(function|class|interface|type|const|let|var|enum)[[:space:]]+${symbol}([^A-Za-z0-9_$]|$)`
  );
}

export function resolveTarget(root, query) {
  const candidate = toPosix(
    isAbsolute(query) ? relative(root, query) : query.replace(/^\.\//u, ""),
  );
  if (!candidate.startsWith("..") && existsSync(resolve(root, candidate))) {
    return { kind: "path", path: candidate };
  }
  if (IDENTIFIER.test(query)) return { kind: "symbol", symbol: query };
  throw new MapError(`not a repository path or an identifier: ${query}`, 4);
}

function uniqueByLocation(hits) {
  const seen = new Set();
  const unique = [];
  for (const hit of hits) {
    const key = `${hit.path}:${String(hit.line)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
  }
  return unique.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

export function moduleStem(path) {
  const base = basename(path);
  const withoutExtension = base.slice(0, base.length - extname(base).length);
  if (withoutExtension === "index" || withoutExtension === "mod") {
    const parts = toPosix(path).split("/");
    return parts.length > 1 ? parts[parts.length - 2] : withoutExtension;
  }
  return withoutExtension.replace(/\.(?:test|spec)$/u, "");
}

function candidateTests(root, workspace, keys, limit) {
  if (workspace === null) return [];
  const stems = keys
    .filter((key) => typeof key === "string" && key.length > 1)
    .map((key) => key.toLowerCase());
  const files = gitText(root, ["ls-files", "--", workspace.dir]).split("\n").filter(Boolean);
  const matches = files
    .filter((file) => /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(file))
    .filter((file) => {
      const base = basename(file).toLowerCase();
      return stems.some((stem) => base.includes(stem));
    });
  return matches.sort((a, b) => a.localeCompare(b)).slice(0, limit);
}

function scopedInstructions(root, workspace) {
  const files = ["AGENTS.md"];
  if (workspace === null) return files;
  const candidate = `${workspace.dir}/AGENTS.md`;
  if (existsSync(resolve(root, candidate))) files.push(candidate);
  return files;
}

function scopePage(root, workspace, instructions) {
  if (workspace === null) return "docs/adr/by-scope/repository.md";
  const scoped = instructions.find((file) => file !== "AGENTS.md");
  if (scoped === undefined) return null;
  const text = readFileSync(resolve(root, scoped), "utf8");
  const match = /by-scope\/([a-z0-9-]+)\.md/u.exec(text);
  return match === null ? null : `docs/adr/by-scope/${match[1]}.md`;
}

function ruleEntries(root, page, limit) {
  if (page === null || !existsSync(resolve(root, page))) return [];
  return readFileSync(resolve(root, page), "utf8")
    .split("\n")
    .filter((line) => line.startsWith("- [ADR-"))
    .slice(0, limit);
}

function exportEntries(manifest) {
  const exports = manifest?.exports;
  if (exports === null || typeof exports !== "object") return [];
  return Object.entries(exports)
    .map(([key, value]) => {
      if (typeof value === "string") return { key, target: value };
      const target = value?.types ?? value?.default ?? value?.import ?? "?";
      return { key, target };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function validationCommands(workspace) {
  if (workspace === null) return ["pnpm preflight", "pnpm check:doc-budgets"];
  if (workspace.kind === "content") return ["pnpm content:check"];
  const order = ["build", "typecheck", "test", "lint"];
  return order
    .filter((script) => typeof workspace.scripts[script] === "string")
    .map((script) => `pnpm --filter ${workspace.name} ${script}`);
}

const CHANGE_LABELS = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "copied" };

export function changeState(root, path) {
  const output = gitText(root, ["status", "--porcelain", "--", path]).trim();
  if (output === "") return "clean";
  const labels = new Set();
  for (const line of output.split("\n")) {
    const code = line.slice(0, 2);
    if (code.includes("?")) labels.add("untracked");
    else {
      for (const character of code) {
        const label = CHANGE_LABELS[character];
        if (label !== undefined) labels.add(label);
      }
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b)).join(",");
}

function goldenArtifacts(root, workspace, instructions) {
  const scoped = instructions.find((file) => file !== "AGENTS.md");
  if (scoped === undefined) return [];
  const text = readFileSync(resolve(root, scoped), "utf8");
  if (!/golden/iu.test(text)) return [];
  const artifacts = ["docs/agents/golden-repin.md"];
  if (existsSync(resolve(root, "golden/hashes.json"))) artifacts.unshift("golden/hashes.json");
  return artifacts;
}

export function buildReport(root, query, limit) {
  const workspaces = discoverWorkspaces(root);
  const target = resolveTarget(root, query);
  let definitions = [];
  let references = [];
  let symbol = null;
  if (target.kind === "path") {
    symbol = moduleStem(target.path);
    references = [];
  } else {
    symbol = target.symbol;
    definitions = uniqueByLocation(symbolHits(root, symbol, definitionPattern(symbol)));
    references = uniqueByLocation(
      symbolHits(root, symbol, symbol).filter(
        (hit) =>
          hit.text !== "" && !definitions.some((d) => d.path === hit.path && d.line === hit.line),
      ),
    );
    if (definitions.length === 0 && references.length === 0) {
      throw new MapError(`no definition or reference found for ${symbol}`, 4);
    }
    const files = [...new Set(definitions.map((definition) => definition.path))];
    if (files.length > 1) {
      throw new MapError(
        `${symbol} is defined in ${String(files.length)} files; narrow the query`,
        3,
        definitions.map((definition) => `${definition.path}:${String(definition.line)}`),
      );
    }
  }
  const path =
    target.kind === "path"
      ? target.path
      : (definitions[0]?.path ?? references[0]?.path ?? target.symbol);
  const workspace = workspaceForPath(path, workspaces);
  const instructions = scopedInstructions(root, workspace);
  const page = scopePage(root, workspace, instructions);
  const manifest = workspace === null ? null : readJsonSafe(root, `${workspace.dir}/package.json`);
  return {
    formatVersion: FORMAT_VERSION,
    query,
    kind: target.kind,
    owner:
      workspace === null
        ? null
        : { name: workspace.name, dir: workspace.dir, kind: workspace.kind },
    path,
    instructions,
    rules: { path: page, entries: ruleEntries(root, page, limit) },
    manifest: workspace === null ? null : `${workspace.dir}/package.json`,
    exports: exportEntries(manifest),
    definitions,
    references: references.slice(0, limit),
    referenceCount: references.length,
    tests: candidateTests(root, workspace, [symbol, moduleStem(path)], 5),
    validation: validationCommands(workspace),
    change: changeState(root, path),
    goldens: goldenArtifacts(root, workspace, instructions),
  };
}

function readJsonSafe(root, path) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
  } catch {
    return null;
  }
}

export function renderText(report) {
  const lines = [];
  const owner = report.owner === null ? "repository" : `${report.owner.name} (${report.owner.dir})`;
  lines.push(`owner: ${owner}`);
  lines.push(`path: ${report.path}`);
  lines.push(`instructions: ${report.instructions.join(", ")}`);
  lines.push(`rules: ${report.rules.path ?? "none"}`);
  for (const entry of report.rules.entries) lines.push(`  ${entry}`);
  if (report.manifest !== null) lines.push(`manifest: ${report.manifest}`);
  if (report.exports.length > 0) {
    lines.push(`exports: ${String(report.exports.length)}`);
    for (const entry of report.exports.slice(0, 12)) {
      lines.push(`  ${entry.key} -> ${entry.target}`);
    }
  }
  if (report.definitions.length > 0) {
    lines.push("definitions:");
    for (const hit of report.definitions.slice(0, 5)) {
      lines.push(`  ${hit.path}:${String(hit.line)}`);
    }
  }
  lines.push(`references: ${String(report.referenceCount)}`);
  for (const hit of report.references) {
    lines.push(`  ${hit.path}:${String(hit.line)}  ${hit.text.slice(0, 100)}`);
  }
  lines.push(`tests: ${report.tests.length === 0 ? "none found" : ""}`.trimEnd());
  for (const test of report.tests) lines.push(`  ${test}`);
  lines.push(`validation:`);
  for (const command of report.validation) lines.push(`  ${command}`);
  lines.push(`change: ${report.change}`);
  if (report.goldens.length > 0) lines.push(`goldens: ${report.goldens.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

function printError(error) {
  process.stderr.write(`agent:map: ${error.message}\n`);
  for (const detail of error.details ?? []) process.stderr.write(`  ${detail}\n`);
}

export function run(argv, root = resolve(import.meta.dirname, "..")) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (error instanceof MapError) {
      printError(error);
      return error.code;
    }
    throw error;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  try {
    const report = buildReport(root, options.query, options.limit);
    process.stdout.write(
      options.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report),
    );
    return 0;
  } catch (error) {
    if (error instanceof MapError) {
      printError(error);
      return error.code;
    }
    throw error;
  }
}

if (isEntryPoint(import.meta.url)) process.exit(run(process.argv.slice(2)));
