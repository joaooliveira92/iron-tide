#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { evaluateStop, parseStatusCount, sessionStartIso } from "../lib/stop-gate.mjs";

const STDIN_MAX_CHARS = 2_000_000;

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8").slice(0, STDIN_MAX_CHARS));
  } catch {
    return 0;
  }
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? payload?.cwd ?? process.cwd();
  let state;
  try {
    const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    const dirtyPaths = parseStatusCount(git(cwd, ["status", "--porcelain"]));
    const startedAt = sessionStartIso(payload?.transcript_path);
    const since = startedAt === null ? [] : [`--after=${startedAt}`];
    let unpushedCommits = 0;
    try {
      unpushedCommits = Number(
        git(cwd, ["rev-list", "--count", ...since, "@{upstream}..HEAD"]).trim(),
      );
    } catch {
      unpushedCommits = Number(
        git(cwd, ["rev-list", "--count", ...since, "HEAD", "--not", "--remotes"]).trim(),
      );
    }
    state = { branch, dirtyPaths, unpushedCommits };
  } catch {
    return 0;
  }
  const verdict = evaluateStop({ hookActive: payload?.stop_hook_active === true, ...state });
  if (verdict.action === "block") {
    process.stdout.write(`${JSON.stringify({ decision: "block", reason: verdict.message })}\n`);
  }
  return 0;
}

process.exit(main());
