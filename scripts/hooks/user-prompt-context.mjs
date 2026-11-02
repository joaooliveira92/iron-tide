#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { evaluatePrompt, latestContext, readTail } from "../lib/transcript-context.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "../data/agent-context-policy.json");
const STDIN_MAX_CHARS = 2_000_000;

function main() {
  let policy;
  let payload;
  try {
    policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
    payload = JSON.parse(readFileSync(0, "utf8").slice(0, STDIN_MAX_CHARS));
  } catch {
    process.stderr.write("context-guard: skipped (unreadable policy or hook input)\n");
    return 0;
  }
  const transcriptPath = payload?.transcript_path;
  if (typeof transcriptPath !== "string" || transcriptPath === "") return 0;
  let verdict;
  try {
    const { tokens, lastActivityMs } = latestContext(
      readTail(transcriptPath, policy.transcriptTailBytes),
    );
    verdict = evaluatePrompt({
      prompt: payload.prompt,
      tokens,
      lastActivityMs,
      nowMs: Date.now(),
      policy,
    });
  } catch {
    process.stderr.write("context-guard: skipped (transcript unreadable)\n");
    return 0;
  }
  if (verdict.action === "block") {
    process.stderr.write(`context-guard: ${verdict.message}\n`);
    return 2;
  }
  if (verdict.action === "warn" || verdict.action === "advise") {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: verdict.message,
        },
      })}\n`,
    );
  }
  return 0;
}

process.exitCode = main();
