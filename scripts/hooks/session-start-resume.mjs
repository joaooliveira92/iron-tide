#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildResumeContext, latestHandoff, matchBrief } from "../lib/session-resume.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "../data/agent-context-policy.json");
const STATUS_MAX_LINES = 8;
const MS_PER_MINUTE = 60_000;

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function main() {
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  try {
    const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
    const branch = git(cwd, ["branch", "--show-current"]).trim();
    const statusLines = git(cwd, ["status", "--short"])
      .split("\n")
      .filter((line) => line !== "")
      .slice(0, STATUS_MAX_LINES);
    let briefNames = [];
    try {
      briefNames = readdirSync(join(cwd, ".ai", "briefs"));
    } catch {
      briefNames = [];
    }
    const text = buildResumeContext({
      branch,
      statusLines,
      brief: matchBrief(branch, briefNames),
      handoff: latestHandoff(process.env.TMPDIR || tmpdir(), {
        nowMs: Date.now(),
        maxAgeMs: policy.resumeHandoffMaxAgeMinutes * MS_PER_MINUTE,
      }),
      maxChars: policy.resumeContextMaxChars,
    });
    process.stdout.write(`${text}\n`);
  } catch {
    return 0;
  }
  return 0;
}

process.exit(main());
