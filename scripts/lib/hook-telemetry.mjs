import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TELEMETRY_SCHEMA_VERSION = 1;
export const TRACKED_EVENTS = [
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "SubagentStart",
  "SubagentStop",
  "SessionEnd",
];
const HASH_CHARS = 16;
const COMMAND_HEAD_CHARS = 120;
const SAFE_SESSION = /[^A-Za-z0-9_-]/gu;

function hashOf(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return createHash("sha256").update(text).digest("hex").slice(0, HASH_CHARS);
}

function responseText(response) {
  if (typeof response === "string") return response;
  if (response === null || response === undefined) return "";
  return JSON.stringify(response);
}

function toolSection(payload) {
  const text = responseText(payload.tool_response);
  const command = payload.tool_input?.command;
  return {
    name: payload.tool_name ?? null,
    use_id: payload.tool_use_id ?? null,
    input_hash: hashOf(payload.tool_input),
    result_hash: hashOf(text),
    result_chars: text.length,
    result_lines: text === "" ? 0 : text.split("\n").length,
    is_error:
      payload.hook_event_name === "PostToolUseFailure" || payload.tool_response?.is_error === true,
    command_head: typeof command === "string" ? command.slice(0, COMMAND_HEAD_CHARS) : null,
    file_path: payload.tool_input?.file_path ?? null,
  };
}

export function buildEvent(payload, timestamp) {
  const type = payload?.hook_event_name;
  if (!TRACKED_EVENTS.includes(type)) return null;
  const event = {
    schema_version: TELEMETRY_SCHEMA_VERSION,
    timestamp,
    session_id: payload.session_id ?? null,
    agent_id: payload.agent_id ?? null,
    event_type: type,
  };
  if (type === "PostToolUse" || type === "PostToolUseFailure") event.tool = toolSection(payload);
  if (type === "PreCompact") event.compaction = { trigger: payload.trigger ?? "unknown" };
  if (type === "SubagentStart" || type === "SubagentStop") {
    event.subagent = { agent_type: payload.agent_type ?? null };
  }
  return event;
}

export function telemetryDir(policy, env = process.env) {
  return env[policy.telemetryDirEnv] ?? join(homedir(), ".claude", "telemetry");
}

function sessionFile(dir, sessionId, suffix) {
  return join(dir, `${String(sessionId ?? "unknown").replace(SAFE_SESSION, "_")}.${suffix}`);
}

export function appendEvent(dir, event) {
  mkdirSync(dir, { recursive: true });
  appendFileSync(sessionFile(dir, event.session_id, "events.jsonl"), `${JSON.stringify(event)}\n`);
}

export function readBand(dir, sessionId) {
  try {
    const state = JSON.parse(readFileSync(sessionFile(dir, sessionId, "state.json"), "utf8"));
    return Number.isInteger(state.band) ? state.band : 0;
  } catch {
    return 0;
  }
}

export function writeBand(dir, sessionId, band) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(sessionFile(dir, sessionId, "state.json"), JSON.stringify({ band }));
}

export function bandOf(tokens, policy) {
  if (tokens === null) return 0;
  if (tokens >= policy.contextBlockTokens) return 3;
  if (tokens >= policy.contextWarnTokens) return 2;
  if (tokens >= policy.contextAdvisorTokens) return 1;
  return 0;
}

export function budgetAdvice({ previousBand, tokens, policy }) {
  const band = bandOf(tokens, policy);
  if (band <= previousBand) return { band, message: "" };
  const k = Math.round(tokens / 1000);
  const messages = {
    1: `Context budget: ${k}k tokens. Keep working: the handoff is due at ${Math.round(policy.contextWarnTokens / 1000)}k, not now. Do not re-read unchanged files or run unfiltered command output; call the advisor only if needed, it forwards the whole transcript.`,
    2: `Context budget: ${k}k tokens (cap ${Math.round(policy.contextWarnTokens / 1000)}k). Finish the current step, commit, run /handoff, and recommend a fresh session.`,
    3: `Context budget exhausted: ${k}k tokens (limit ${Math.round(policy.contextBlockTokens / 1000)}k). Stop exploring, commit, and write the handoff now.`,
  };
  return { band, message: messages[band] };
}
