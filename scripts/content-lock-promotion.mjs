#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const LOCK_PATH = "content/production/1880/content-lock.json";
export const COMMIT_SUBJECT =
  "chore(content): record content lock body hash for dev to main promotion";

const ROOT = resolve(import.meta.dirname, "..");
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function promotionBranchName(date) {
  const match = DATE_PATTERN.exec(date);
  const isCalendarDate =
    match !== null &&
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
      .toISOString()
      .slice(0, 10) === date;
  if (!isCalendarDate) {
    throw new Error(`promotion date must be YYYY-MM-DD, got "${date}"`);
  }
  return `promote/${date}`;
}

export function devLockProblems(lock) {
  const records = typeof lock === "object" && lock !== null && "bodyHash" in lock;
  return records
    ? [
        `${LOCK_PATH} records a body hash; dev must not carry it (promote with pnpm promote:content-lock)`,
      ]
    : [];
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function runContentLock(cwd) {
  execFileSync("pnpm", ["content:lock"], { cwd, stdio: "inherit" });
}

export function promote({ cwd = ROOT, date, base = "origin/dev", runLock = runContentLock }) {
  const branch = promotionBranchName(date);
  if (git(cwd, ["status", "--porcelain"]).trim() !== "") {
    throw new Error("working tree has uncommitted changes; commit or stash them first");
  }
  if (git(cwd, ["branch", "--list", branch]).trim() !== "") {
    throw new Error(`${branch} already exists; delete it or choose another --date`);
  }
  if (base.startsWith("origin/")) {
    git(cwd, ["fetch", "--no-tags", "origin", base.slice("origin/".length)]);
  }
  git(cwd, ["switch", "-c", branch, base]);
  runLock(cwd);

  const changed = git(cwd, ["status", "--porcelain", "--untracked-files=all"])
    .split("\n")
    .filter(Boolean);
  if (changed.length === 0) {
    throw new Error(`content lock unchanged on ${branch}; nothing to promote`);
  }
  const unexpected = changed.filter((line) => line.slice(3) !== LOCK_PATH);
  if (unexpected.length > 0) {
    throw new Error(`content:lock changed unexpected paths: ${unexpected.join(", ")}`);
  }

  git(cwd, ["add", "--", LOCK_PATH]);
  git(cwd, ["commit", "-q", "-m", COMMIT_SUBJECT]);
  return { branch, commit: git(cwd, ["rev-parse", "HEAD"]).trim() };
}

export function checkDevLock({ cwd = ROOT } = {}) {
  return devLockProblems(JSON.parse(readFileSync(resolve(cwd, LOCK_PATH), "utf8")));
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!["--date", "--base"].includes(key) || value === undefined) {
      throw new Error("usage: promote [--date YYYY-MM-DD] [--base origin/dev]");
    }
    options[key.slice(2)] = value;
  }
  return options;
}

function main(argv) {
  const [command, ...rest] = argv;
  if (command === "check-dev") {
    const problems = checkDevLock();
    for (const problem of problems) console.error(problem);
    if (problems.length === 0) console.log("content-lock-promotion: dev carries no body hash");
    return problems.length === 0 ? 0 : 1;
  }
  if (command === "promote") {
    const options = parseOptions(rest);
    const date = options.date ?? new Date().toISOString().slice(0, 10);
    const { branch, commit } = promote({ date, base: options.base ?? "origin/dev" });
    console.log(`content-lock-promotion: ${branch} at ${commit}`);
    console.log("next (not run): git push -u origin " + branch);
    console.log(`next (not run): gh pr create --base main --head ${branch}`);
    return 0;
  }
  console.error(
    "usage: content-lock-promotion.mjs promote [--date YYYY-MM-DD] [--base origin/dev] | check-dev",
  );
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `content-lock-promotion: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
