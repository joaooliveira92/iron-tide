#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { lockedMessage, openStreak } from "../lib/mutation-streak.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "../data/agent-context-policy.json");
const STDIN_MAX_CHARS = 1_000_000;
const MUTATING_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

function main() {
  let policy;
  let payload;
  try {
    policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
    payload = JSON.parse(readFileSync(0, "utf8").slice(0, STDIN_MAX_CHARS));
  } catch {
    process.stderr.write("agent-guard: skipped (unreadable policy or hook input)\n");
    return 0;
  }
  const streak = openStreak({ policy, env: process.env, sessionId: payload?.session_id });
  if (streak === null) return 0;
  const tool = payload.tool_name;
  if (tool === "Grep") {
    streak.reset();
    return 0;
  }
  if (!MUTATING_TOOLS.has(tool)) return 0;
  if (streak.locked()) {
    process.stderr.write(`agent-guard: ${lockedMessage(policy)}\n`);
    return 2;
  }
  streak.reset();
  return 0;
}

process.exitCode = main();
