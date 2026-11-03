#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { evaluateBashCommand, parseOverride } from "../lib/agent-guard.mjs";
import { rangeReadTargets, trailingChainLength } from "../lib/read-chain.mjs";
import { readTail } from "../lib/transcript-context.mjs";

const POLICY_PATH = resolve(import.meta.dirname, "../data/agent-context-policy.json");
const STDIN_MAX_CHARS = 1_000_000;

function readStdin() {
  try {
    return readFileSync(0, "utf8").slice(0, STDIN_MAX_CHARS);
  } catch {
    return "";
  }
}

function auditOverride(policy, command, rule, reason) {
  const target =
    process.env[policy.guardAuditLogEnv] ??
    resolve(homedir(), ".claude/tools/ctx-audit/guard-overrides.log");
  try {
    mkdirSync(dirname(target), { recursive: true });
    const entry = { at: new Date().toISOString(), rule, reason, command: command.slice(0, 300) };
    appendFileSync(target, `${JSON.stringify(entry)}\n`);
  } catch {
    process.stderr.write("agent-guard: override log unavailable\n");
  }
}

function main() {
  let policy;
  let payload;
  try {
    policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
    payload = JSON.parse(readStdin());
  } catch {
    process.stderr.write("agent-guard: skipped (unreadable policy or hook input)\n");
    return 0;
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== "string" || command === "") return 0;
  let verdict;
  try {
    verdict = evaluateBashCommand({
      command,
      cwd: typeof payload.cwd === "string" ? payload.cwd : process.cwd(),
      policy,
    });
  } catch {
    process.stderr.write("agent-guard: skipped (evaluation error)\n");
    return 0;
  }
  if (verdict.decision === "block") {
    process.stderr.write(`agent-guard: ${verdict.message.slice(0, policy.hookStderrMaxChars)}\n`);
    return 2;
  }
  if (verdict.override !== null) {
    auditOverride(policy, command, verdict.rule, verdict.override.reason);
    return 0;
  }
  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
  const chained = chainedTarget(policy, payload, command, cwd);
  if (chained === null) return 0;
  const override = parseOverride(command, policy);
  if (override !== null) {
    auditOverride(policy, command, "read-chain", override.reason);
    return 0;
  }
  process.stdout.write(`${JSON.stringify(denial(policy, chained))}\n`);
  return 0;
}

function chainedTarget(policy, payload, command, cwd) {
  try {
    const targets = rangeReadTargets(command, cwd);
    if (targets.length === 0 || typeof payload.transcript_path !== "string") return null;
    const lines = readTail(payload.transcript_path, policy.transcriptTailBytes);
    return (
      targets.find(
        (path) =>
          trailingChainLength({
            lines,
            path,
            cwd,
            currentToolUseId: payload.tool_use_id,
          }) >=
          policy.readChainDenyAt - 1,
      ) ?? null
    );
  } catch {
    return null;
  }
}

function denial(policy, path) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `Read ${path} in ranges ${policy.readChainDenyAt} times in a row. ` +
        `Locate with \`rg -n -C3 <pattern> ${path} | head -${policy.readRangeMaxLines}\` or \`pnpm agent:map <symbol>\`, ` +
        `or read one larger block with the Read tool. ` +
        `Override (audited): append \`# ${policy.overrideToken} <reason>\` to the command.`,
    },
  };
}

process.exitCode = main();
