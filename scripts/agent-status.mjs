#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { isEntryPoint } from "./lib/paths.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "data/agent-context-policy.json");
const USAGE = "usage: pnpm agent:status [--log <path>] [--base <ref>] [--no-pr]";
const MAX_DIRTY_SHOWN = 10;
const MAX_CHECKS_SHOWN = 8;
const FAILED = new Set(["FAILURE", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED", "ERROR"]);

export function defaultRunner(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

export function parseArguments(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      log: { type: "string" },
      base: { type: "string", default: "origin/dev" },
      "no-pr": { type: "boolean", default: false },
    },
    strict: true,
  });
  return { log: values.log ?? null, base: values.base, pr: !values["no-pr"] };
}

function attempt(run, command, args, { trim = true } = {}) {
  try {
    const output = run(command, args);
    return trim ? output.trim() : output;
  } catch {
    return null;
  }
}

export function summariseChecks(rollup) {
  const checks = Array.isArray(rollup) ? rollup : [];
  const failed = [];
  const pending = [];
  for (const check of checks) {
    const name = check.name ?? check.context ?? "check";
    const verdict = check.conclusion ?? check.state ?? "";
    if (FAILED.has(verdict)) failed.push(name);
    else if (check.status !== undefined && check.status !== "COMPLETED") pending.push(name);
    else if (verdict === "PENDING" || verdict === "") pending.push(name);
  }
  return { total: checks.length, failed, pending };
}

export function collect({ run, base, pr, log, tailLines }) {
  const branch = attempt(run, "git", ["branch", "--show-current"]) ?? "(detached)";
  const head = attempt(run, "git", ["log", "-1", "--format=%h %s"]) ?? "(no commits)";
  const counts = attempt(run, "git", ["rev-list", "--left-right", "--count", `${base}...HEAD`]);
  const [behind, ahead] = counts === null ? [null, null] : counts.split(/\s+/u);
  const porcelain = attempt(run, "git", ["status", "--porcelain"], { trim: false }) ?? "";
  const dirty = porcelain.split("\n").filter(Boolean);
  const prJson = pr
    ? attempt(run, "gh", [
        "pr",
        "view",
        "--json",
        "number,state,isDraft,url,reviewDecision,statusCheckRollup",
      ])
    : null;
  const logText = log === null ? null : attempt(run, "tail", ["-n", String(tailLines), log]);
  return {
    branch,
    head,
    base,
    behind,
    ahead,
    dirty,
    pr: prJson === null ? null : parsePr(prJson),
    log: log === null ? null : { path: log, text: logText },
  };
}

function parsePr(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function render(status) {
  const lines = [`branch ${status.branch} @ ${status.head}`];
  if (status.ahead !== null) {
    lines.push(`vs ${status.base}: ahead ${status.ahead}, behind ${status.behind}`);
  }
  if (status.dirty.length === 0) lines.push("tree clean");
  else {
    lines.push(`tree dirty: ${status.dirty.length} paths`);
    for (const row of status.dirty.slice(0, MAX_DIRTY_SHOWN)) lines.push(`  ${row}`);
    const hidden = status.dirty.length - MAX_DIRTY_SHOWN;
    if (hidden > 0) lines.push(`  ... ${hidden} more`);
  }
  if (status.pr !== null) {
    const { total, failed, pending } = summariseChecks(status.pr.statusCheckRollup);
    const draft = status.pr.isDraft ? " draft" : "";
    lines.push(`PR #${status.pr.number} ${status.pr.state}${draft} ${status.pr.url}`);
    lines.push(
      `checks: ${total - failed.length - pending.length} ok, ${failed.length} failed, ${pending.length} pending; review ${status.pr.reviewDecision || "none"}`,
    );
    for (const name of [...failed, ...pending].slice(0, MAX_CHECKS_SHOWN)) lines.push(`  ${name}`);
  } else {
    lines.push("PR: none found");
  }
  if (status.log !== null) {
    lines.push(`log ${status.log.path}:`);
    lines.push(status.log.text === null ? "  (unreadable)" : status.log.text);
  }
  return lines;
}

export function main(argv, { run = defaultRunner, tailLines = 40, out = console.log } = {}) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(`agent-status: ${error instanceof Error ? error.message : String(error)}`);
    console.error(USAGE);
    return 2;
  }
  for (const line of render(collect({ run, tailLines, ...options }))) out(line);
  return 0;
}

function entryOptions() {
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  return { tailLines: policy.quietFailTailLines };
}

if (isEntryPoint(import.meta.url)) process.exitCode = main(process.argv.slice(2), entryOptions());
