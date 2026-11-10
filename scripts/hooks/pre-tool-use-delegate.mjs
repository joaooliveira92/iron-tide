#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { evaluateDelegation } from "../lib/dispatch-stamp.mjs";
import { telemetryDir } from "../lib/hook-telemetry.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "../data/agent-context-policy.json");
const STDIN_MAX_CHARS = 1_000_000;

function main() {
  let policy;
  let payload;
  try {
    policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
    payload = JSON.parse(readFileSync(0, "utf8").slice(0, STDIN_MAX_CHARS));
  } catch {
    return 0;
  }
  if (payload?.tool_input === undefined) return 0;
  let verdict;
  try {
    verdict = evaluateDelegation({
      input: payload.tool_input,
      policy,
      dir: telemetryDir(policy),
      nowMs: Date.now(),
    });
  } catch {
    return 0;
  }
  if (verdict.decision === "block") {
    process.stderr.write(`${verdict.message.slice(0, policy.hookStderrMaxChars * 2)}\n`);
    return 2;
  }
  return 0;
}

process.exit(main());
