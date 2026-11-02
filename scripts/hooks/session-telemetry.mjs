#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  appendEvent,
  budgetAdvice,
  buildEvent,
  readBand,
  telemetryDir,
  writeBand,
} from "../lib/hook-telemetry.mjs";
import { latestContext, readTail } from "../lib/transcript-context.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "../data/agent-context-policy.json");
const STDIN_MAX_CHARS = 2_000_000;

function main() {
  let policy;
  let payload;
  try {
    policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
    payload = JSON.parse(readFileSync(0, "utf8").slice(0, STDIN_MAX_CHARS));
  } catch {
    return 0;
  }
  const event = buildEvent(payload, new Date().toISOString());
  if (event === null) return 0;
  try {
    const dir = telemetryDir(policy);
    appendEvent(dir, event);
    if (event.event_type === "PreCompact") writeBand(dir, event.session_id, 0);
    if (event.event_type !== "PostToolUse" || typeof payload.transcript_path !== "string") return 0;
    const { tokens } = latestContext(readTail(payload.transcript_path, policy.transcriptTailBytes));
    const { band, message } = budgetAdvice({
      previousBand: readBand(dir, event.session_id),
      tokens,
      policy,
    });
    if (band !== readBand(dir, event.session_id)) writeBand(dir, event.session_id, band);
    if (message !== "") {
      process.stdout.write(
        `${JSON.stringify({
          hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message },
        })}\n`,
      );
    }
  } catch {
    process.stderr.write("session-telemetry: skipped\n");
  }
  return 0;
}

process.exitCode = main();
