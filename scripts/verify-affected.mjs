#!/usr/bin/env node
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { renderChangeScope } from "./change-scope.mjs";
import {
  acquireHeavyLock,
  ancestorPidsOf,
  DEFAULT_POLL_MS,
  defaultLockDir,
  isProcessAlive,
} from "./lib/heavy-lock.mjs";
import { isEntryPoint } from "./lib/paths.mjs";
import { discoverWorkspaces, expandDependents, workspaceForPath } from "./lib/workspaces.mjs";

export const DEFAULT_BASE = "dev";
export const LOG_DIR = "node_modules/.cache/bluewave-verify";
const USAGE = "usage: pnpm verify:affected [--base <ref>] [--dry-run] [--verbose] [--help]";

export class VerifyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "VerifyError";
    this.code = code;
  }
}

export function parseArguments(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: {
        base: { type: "string", default: DEFAULT_BASE },
        "dry-run": { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    throw new VerifyError(`${error.message}\n${USAGE}`, 2);
  }
  if (values.help) return { help: true };
  if (values.base.trim() === "") throw new VerifyError("--base must not be empty", 2);
  return { help: false, base: values.base, dryRun: values["dry-run"], verbose: values.verbose };
}

const FULL_SCOPE = [
  /^package\.json$/u,
  /^pnpm-lock\.yaml$/u,
  /^pnpm-workspace\.yaml$/u,
  /^tsconfig(?:\.[^/]+)?\.json$/u,
  /^vite\.config\.(?:ts|mts|js|mjs)$/u,
  /^vitest\.config\.(?:ts|mts|js|mjs)$/u,
  /^\.github\//u,
  /^\.npmrc$/u,
];
const SCRIPT_SCOPE = [/^scripts\//u, /^\.githooks\//u, /^\.opencode\//u];
const DOC_SCOPE = [
  /^docs\//u,
  /^\.ai\//u,
  /^agent-patterns\//u,
  /^\.agents\//u,
  /\.md$/u,
  /^README\.md$/u,
  /^RULES\.md$/u,
  /^CONTEXT\.md$/u,
  /^GLOSSARY-MAP\.md$/u,
];
const GOLDEN_SCOPE = [/^golden\//u];

function matches(path, patterns) {
  return patterns.some((pattern) => pattern.test(path));
}

function emptyUnit(dir, name, kind) {
  return { dir, name, kind, scripts: {}, dependencies: [], exports: null };
}

export function planAffected({ paths, workspaces }) {
  const normalized = [...new Set(paths)].sort((a, b) => a.localeCompare(b));
  if (normalized.length === 0) return { full: false, reasons: {}, units: [] };
  const shared = normalized.filter((path) => matches(path, FULL_SCOPE));
  if (shared.length > 0) {
    const units = workspaces.map((workspace) => {
      const scripts = { ...workspace.scripts };
      delete scripts.lint;
      return { ...workspace, kind: workspace.kind, scripts };
    });
    units.push(emptyUnit("docs", "documentation", "docs"));
    units.push(emptyUnit("scripts", "repository-scripts", "scripts"));
    units.push(emptyUnit("golden", "golden", "golden"));
    units.sort((a, b) => a.dir.localeCompare(b.dir));
    return { full: true, reasons: { shared }, units };
  }
  const reasons = {};
  const named = new Set();
  const kinds = new Set();
  const unknown = [];
  for (const path of normalized) {
    if (matches(path, GOLDEN_SCOPE)) {
      kinds.add("golden");
      reasons.golden = [...(reasons.golden ?? []), path];
      continue;
    }
    if (matches(path, SCRIPT_SCOPE)) {
      kinds.add("scripts");
      reasons.scripts = [...(reasons.scripts ?? []), path];
      continue;
    }
    if (matches(path, DOC_SCOPE)) {
      kinds.add("docs");
      reasons.docs = [...(reasons.docs ?? []), path];
      continue;
    }
    const workspace = workspaceForPath(path, workspaces);
    if (workspace === null) {
      unknown.push(path);
      continue;
    }
    named.add(workspace.name);
    reasons[workspace.name] = [...(reasons[workspace.name] ?? []), path];
  }
  if (unknown.length > 0) {
    const units = workspaces.map((workspace) => {
      const scripts = { ...workspace.scripts };
      delete scripts.lint;
      return { ...workspace, kind: workspace.kind, scripts };
    });
    units.push(emptyUnit("docs", "documentation", "docs"));
    units.push(emptyUnit("scripts", "repository-scripts", "scripts"));
    units.push(emptyUnit("golden", "golden", "golden"));
    units.sort((a, b) => a.dir.localeCompare(b.dir));
    return { full: true, reasons: { unowned: unknown }, units };
  }
  const expanded = expandDependents([...named], workspaces);
  for (const name of expanded) {
    if (reasons[name] === undefined) reasons[name] = ["depends on a changed package"];
  }
  const units = workspaces
    .filter((workspace) => named.has(workspace.name) || expanded.includes(workspace.name))
    .map((workspace) => ({ ...workspace, kind: workspace.kind }));
  if (kinds.has("docs")) units.push(emptyUnit("docs", "documentation", "docs"));
  if (kinds.has("scripts")) units.push(emptyUnit("scripts", "repository-scripts", "scripts"));
  if (kinds.has("golden")) units.push(emptyUnit("golden", "golden", "golden"));
  units.sort((a, b) => a.dir.localeCompare(b.dir));
  return { full: false, reasons, units };
}

export function unitCommands(unit) {
  if (unit.kind === "docs") {
    return [
      { label: "docs-check", argv: ["node", "scripts/docs-check.cjs"] },
      { label: "doc-budgets", argv: ["node", "scripts/verify-doc-budgets.mjs"] },
    ];
  }
  if (unit.kind === "scripts") {
    return [
      { label: "test:scripts", argv: ["pnpm", "test:scripts"] },
      { label: "preflight", argv: ["pnpm", "preflight"] },
    ];
  }
  if (unit.kind === "content") return [{ label: "content:check", argv: ["pnpm", "content:check"] }];
  if (unit.kind === "golden") return [{ label: "check:golden", argv: ["pnpm", "check:golden"] }];
  const order = ["build", "typecheck", "test", "lint"];
  return order
    .filter((script) => typeof unit.scripts[script] === "string")
    .map((script) => ({ label: script, argv: ["pnpm", "--filter", unit.name, script] }));
}

function safeName(name) {
  return name.replace(/[^A-Za-z0-9-]/gu, "_");
}

function logTail(path, lines = 40) {
  try {
    const content = readFileSync(path, "utf8").trimEnd().split("\n");
    return content.slice(-lines).join("\n");
  } catch {
    return "";
  }
}

function runCommand({ argv, cwd, logPath, verbose, onChild }) {
  return new Promise((resolvePromise) => {
    const fd = openSync(logPath, "w");
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      closeSync(fd);
      resolvePromise(result);
    };
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", verbose ? "pipe" : fd, verbose ? "pipe" : fd],
    });
    onChild(child);
    if (verbose) {
      for (const stream of [child.stdout, child.stderr]) {
        stream?.on("data", (chunk) => {
          writeSync(fd, chunk);
          process.stderr.write(chunk);
        });
      }
    }
    child.on("error", (error) => finish({ code: 1, error: error.message }));
    child.on("exit", (code, signal) =>
      finish({ code: code ?? (signal === null ? 1 : 128), signal }),
    );
  });
}

function readPlan(root, base) {
  try {
    const report = JSON.parse(renderChangeScope(["--base", base], root));
    return [
      ...report.paths.committed,
      ...report.paths.staged,
      ...report.paths.unstaged,
      ...report.paths.untracked,
    ];
  } catch (error) {
    throw new VerifyError(`cannot compute change scope against ${base}: ${error.message}`, 2);
  }
}

function now() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

export async function execute(
  plan,
  { root, dryRun, verbose, out = process.stdout, err = process.stderr },
  {
    acquireLock = acquireHeavyLock,
    spawnCommand = runCommand,
    registerSignal = (signal, handler) => process.on(signal, handler),
  } = {},
) {
  const targets = plan.units.filter((unit) => unitCommands(unit).length > 0);
  if (targets.length === 0) {
    out.write("verify:affected: no affected packages; nothing to verify\n");
    return 0;
  }
  if (dryRun) {
    for (const unit of targets) {
      const labels = unitCommands(unit)
        .map((command) => command.label)
        .join(",");
      out.write(`PLAN ${unit.dir} (${labels})\n`);
    }
    out.write(
      `verify:affected: ${String(targets.length)} unit(s) planned${plan.full ? " (full scope)" : ""}\n`,
    );
    return 0;
  }
  const logDir = resolve(root, LOG_DIR);
  rmSync(logDir, { recursive: true, force: true });
  mkdirSync(logDir, { recursive: true });
  const release = await acquireLock({
    lockDir: process.env.BLUEWAVE_HEAVY_LOCK_DIR ?? defaultLockDir(),
    pid: process.pid,
    command: "verify:affected",
    isAlive: isProcessAlive,
    ancestorPids: ancestorPidsOf(process.pid),
    wait: () => new Promise((done) => setTimeout(done, DEFAULT_POLL_MS)),
    onWait: (holder) =>
      err.write(
        `verify:affected: waiting for pid ${String(holder?.pid ?? "?")} (${holder?.command ?? "unknown"})\n`,
      ),
  });
  let active = null;
  let interrupted = false;
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    registerSignal(signal, () => {
      interrupted = true;
      active?.kill(signal);
    });
  }
  const failures = [];
  const started = now();
  for (const unit of targets) {
    if (interrupted) break;
    const commands = unitCommands(unit);
    const unitStarted = now();
    let failed = null;
    for (const command of commands) {
      if (interrupted) break;
      const logPath = resolve(logDir, `${safeName(unit.name)}-${command.label}.log`);
      const result = await spawnCommand({
        argv: command.argv,
        cwd: root,
        logPath,
        verbose,
        onChild: (child) => {
          active = child;
        },
      });
      if (result.code !== 0) {
        failed = { unit, command, logPath, result };
        break;
      }
    }
    active = null;
    const seconds = Math.round((now() - unitStarted) / 1000);
    if (failed === null) {
      const labels = commands.map((command) => command.label).join(",");
      out.write(`PASS ${unit.dir} (${labels}) ${String(seconds)}s\n`);
    } else {
      failures.push(failed);
      out.write(
        `FAIL ${unit.dir} ${failed.command.label} (exit ${String(failed.result.code)}) log: ${failed.logPath}\n`,
      );
    }
  }
  release();
  if (interrupted) {
    err.write("verify:affected: cancelled\n");
    return 130;
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      err.write(`\n--- ${failure.unit.dir} ${failure.command.label} ---\n`);
      err.write(`${logTail(failure.logPath)}\n`);
    }
    out.write(
      `verify:affected: ${String(failures.length)} of ${String(targets.length)} unit(s) failed\n`,
    );
    return 1;
  }
  const seconds = Math.round((now() - started) / 1000);
  out.write(
    `verify:affected: ${String(targets.length)} unit(s) passed in ${String(seconds)}s${plan.full ? " (full scope)" : ""}\n`,
  );
  return 0;
}

export async function run(argv, root = resolve(import.meta.dirname, "..")) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (error instanceof VerifyError) {
      process.stderr.write(`verify:affected: ${error.message}\n`);
      return error.code;
    }
    throw error;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  try {
    const paths = readPlan(root, options.base);
    const plan = planAffected({ paths, workspaces: discoverWorkspaces(root) });
    return await execute(plan, { root, dryRun: options.dryRun, verbose: options.verbose });
  } catch (error) {
    if (error instanceof VerifyError) {
      process.stderr.write(`verify:affected: ${error.message}\n`);
      return error.code;
    }
    throw error;
  }
}

if (isEntryPoint(import.meta.url)) process.exit(await run(process.argv.slice(2)));
