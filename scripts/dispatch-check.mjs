#!/usr/bin/env node
import { execFileSync } from "node:child_process";

import { isEntryPoint } from "./lib/paths.mjs";
import { MAX_WORKTREES, TERMINAL_STATES, parseWorktreeList } from "./worktree.mjs";
import { readRegistryFile, registryPath } from "./worktree-registry.mjs";

export const DECISION_LABELS = ["needs-decision", "needs-triage", "needs-info"];
export const FAILING_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "startup_failure",
  "action_required",
]);
export const IGNORED_CONCLUSIONS = new Set(["cancelled", "stale"]);
export const EXIT_CLEAR = 0;
export const EXIT_TOOL_ERROR = 1;
export const EXIT_BLOCKED = 2;

const USAGE = "usage: pnpm dispatch:check <issue-number>...";
const CLOSING_KEYWORD = String.raw`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)`;
const FIX_OR_FEAT = /\b(?:fix(?:e[sd])?|feat|close[sd]?|resolve[sd]?)\b/iu;
const FIELD_SEPARATOR = "\u001f";
const RECORD_SEPARATOR = "\u001e";

export class DispatchCheckError extends Error {
  constructor(message) {
    super(message);
    this.name = "DispatchCheckError";
  }
}

export function parseIssueNumbers(argv) {
  if (argv.length === 0) throw new DispatchCheckError(USAGE);
  const numbers = [];
  for (const raw of argv) {
    const token = raw.replace(/^#/u, "");
    if (!/^[1-9][0-9]*$/u.test(token)) {
      throw new DispatchCheckError(`not an issue number: ${raw}\n${USAGE}`);
    }
    const value = Number(token);
    if (!numbers.includes(value)) numbers.push(value);
  }
  return numbers;
}

const mentions = (text, number) => new RegExp(`(?<![\\w/])#${number}(?!\\d)`, "u").test(text);

const closes = (text, number) =>
  new RegExp(`\\b${CLOSING_KEYWORD}:?\\s+#${number}(?!\\d)`, "iu").test(text);

const branchMentions = (branch, number) =>
  new RegExp(`issue-${number}(?!\\d)`, "u").test(branch ?? "");

export function defaultRunner(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function defaultRegistryRows() {
  const registry = readRegistryFile(registryPath());
  return registry === null ? [] : registry.rows;
}

function runJson(run, command, args) {
  let output;
  try {
    output = run(command, args);
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error).split("\n")[0];
    throw new DispatchCheckError(`${command} ${args.slice(0, 3).join(" ")} failed: ${detail}`);
  }
  try {
    return JSON.parse(output);
  } catch {
    throw new DispatchCheckError(`${command} ${args.slice(0, 3).join(" ")} returned invalid JSON`);
  }
}

function runText(run, command, args) {
  try {
    return run(command, args);
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error).split("\n")[0];
    throw new DispatchCheckError(`${command} ${args.slice(0, 3).join(" ")} failed: ${detail}`);
  }
}

export function parseDevCommits(output) {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.replace(/^\n+/u, ""))
    .filter((record) => record.length > 0)
    .map((record) => {
      const [sha = "", subject = "", body = ""] = record.split(FIELD_SEPARATOR);
      return { sha, subject, body };
    });
}

export function collectDevHealth(runs) {
  const latest = new Map();
  for (const entry of runs) {
    if (entry.status !== undefined && entry.status !== "completed") continue;
    if (IGNORED_CONCLUSIONS.has(entry.conclusion) || !entry.conclusion) continue;
    if (!latest.has(entry.workflowName)) latest.set(entry.workflowName, entry.conclusion);
  }
  const red = [...latest.entries()]
    .filter(([, conclusion]) => FAILING_CONCLUSIONS.has(conclusion))
    .map(([name]) => name)
    .sort();
  return { red, workflows: latest.size };
}

export function collectFacts({ run, readRegistryRows }, numbers) {
  const issues = new Map();
  for (const number of numbers) {
    const issue = runJson(run, "gh", [
      "issue",
      "view",
      String(number),
      "--json",
      "number,state,labels",
    ]);
    const log = runText(run, "git", [
      "log",
      "origin/dev",
      "--grep",
      `#${number}`,
      `--format=%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
    ]);
    issues.set(number, {
      state: issue.state,
      labels: (issue.labels ?? []).map((label) => label.name),
      commits: parseDevCommits(log),
    });
  }
  const prFields = "number,title,body,headRefName";
  const openPrs = runJson(run, "gh", [
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    prFields,
  ]);
  const mergedPrs = runJson(run, "gh", [
    "pr",
    "list",
    "--state",
    "merged",
    "--limit",
    "200",
    "--json",
    prFields,
  ]);
  const worktrees = parseWorktreeList(runText(run, "git", ["worktree", "list", "--porcelain"]));
  const runs = runJson(run, "gh", [
    "run",
    "list",
    "--branch",
    "dev",
    "--status",
    "completed",
    "--limit",
    "100",
    "--json",
    "workflowName,conclusion,status",
  ]);
  return {
    issues,
    openPrs,
    mergedPrs,
    worktrees,
    registryRows: readRegistryRows(),
    runs,
  };
}

function staleReason(number, issue, mergedPrs) {
  if (issue.state === "CLOSED") return "issue is closed";
  const merged = mergedPrs.find((pr) => closes(`${pr.title}\n${pr.body ?? ""}`, number));
  if (merged) return `merged PR #${merged.number} closes it`;
  const commit = issue.commits.find(
    (entry) =>
      mentions(`${entry.subject}\n${entry.body}`, number) &&
      FIX_OR_FEAT.test(`${entry.subject}\n${entry.body}`),
  );
  if (commit) return `origin/dev ${commit.sha.slice(0, 8)} ${commit.subject}`;
  return null;
}

function claimedReason(number, facts) {
  const pr = facts.openPrs.find(
    (candidate) =>
      mentions(`${candidate.title}\n${candidate.body ?? ""}`, number) ||
      branchMentions(candidate.headRefName, number),
  );
  if (pr) return `open PR #${pr.number} references it`;
  const tree = facts.worktrees.find((entry) => branchMentions(entry.branch, number));
  if (tree) return `worktree branch ${tree.branch}`;
  const row = facts.registryRows.find(
    (candidate) =>
      !TERMINAL_STATES.has(candidate.status) && mentions(candidate.scope ?? "", number),
  );
  if (row) return `worktrees scope ${row.slug} (${row.status})`;
  return null;
}

export function evaluateIssue(number, facts) {
  const issue = facts.issues.get(number);
  const stale = staleReason(number, issue, facts.mergedPrs);
  if (stale) return { number, verdict: "STALE", reason: stale };
  const claimed = claimedReason(number, facts);
  if (claimed) return { number, verdict: "CLAIMED", reason: claimed };
  const label = DECISION_LABELS.find((name) => issue.labels.includes(name));
  if (label) return { number, verdict: "NEEDS-DECISION", reason: `label ${label}` };
  return { number, verdict: "CLEAR", reason: "no fix, claim or decision label found" };
}

export function evaluate(numbers, facts) {
  const health = collectDevHealth(facts.runs);
  const verdicts = numbers.map((number) => evaluateIssue(number, facts));
  return {
    health,
    verdicts,
    worktreeCount: facts.worktrees.length,
    exitCode:
      health.red.length === 0 && verdicts.every((entry) => entry.verdict === "CLEAR")
        ? EXIT_CLEAR
        : EXIT_BLOCKED,
  };
}

export function render(result) {
  const dev =
    result.health.red.length === 0 ? "DEV-GREEN" : `DEV-RED (${result.health.red.join(", ")})`;
  const header = `${dev} worktrees ${result.worktreeCount}/${MAX_WORKTREES}`;
  return [
    header,
    ...result.verdicts.map((entry) => `#${entry.number} ${entry.verdict} ${entry.reason}`),
  ];
}

export function main(
  argv,
  { run = defaultRunner, readRegistryRows = defaultRegistryRows, out = console.log } = {},
) {
  try {
    const numbers = parseIssueNumbers(argv);
    const result = evaluate(numbers, collectFacts({ run, readRegistryRows }, numbers));
    for (const line of render(result)) out(line);
    return result.exitCode;
  } catch (error) {
    console.error(`dispatch-check: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_TOOL_ERROR;
  }
}

if (isEntryPoint(import.meta.url)) process.exitCode = main(process.argv.slice(2));
