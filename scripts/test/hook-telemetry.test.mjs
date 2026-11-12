import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

import {
  TELEMETRY_SCHEMA_VERSION,
  budgetAdvice,
  buildEvent,
  telemetryDir,
} from "../lib/hook-telemetry.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const HOOK = join(ROOT, "scripts/hooks/session-telemetry.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);
const STAMP = "2026-11-02T12:00:00.000Z";

let sandbox;
before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "telemetry-hook-"));
});
after(() => rmSync(sandbox, { recursive: true, force: true }));

const transcriptWith = (name, tokens) => {
  const path = join(sandbox, name);
  const record = {
    type: "assistant",
    timestamp: STAMP,
    message: {
      model: "claude-sonnet-5-5",
      usage: {
        input_tokens: 1,
        cache_read_input_tokens: tokens - 1,
        cache_creation_input_tokens: 0,
      },
    },
  };
  writeFileSync(path, `${JSON.stringify(record)}\n`);
  return path;
};

const toolPayload = (overrides = {}) => ({
  hook_event_name: "PostToolUse",
  session_id: "sess-1",
  tool_name: "Bash",
  tool_use_id: "toolu_1",
  tool_input: { command: "git status" },
  tool_response: "line one\nline two",
  ...overrides,
});

void describe("event schema", () => {
  void test("describes a tool result by hashes and sizes, never by content", () => {
    const event = buildEvent(toolPayload(), STAMP);
    assert.equal(event.schema_version, TELEMETRY_SCHEMA_VERSION);
    assert.equal(event.event_type, "PostToolUse");
    assert.equal(event.tool.name, "Bash");
    assert.equal(event.tool.result_chars, 17);
    assert.equal(event.tool.result_lines, 2);
    assert.equal(event.tool.command_head, "git status");
    assert.equal(event.tool.is_error, false);
    assert.match(event.tool.result_hash, /^[0-9a-f]{16}$/u);
    assert.equal(JSON.stringify(event).includes("line one"), false);
  });

  void test("identical results share a hash and failures are flagged", () => {
    const first = buildEvent(toolPayload(), STAMP);
    const second = buildEvent(toolPayload({ tool_use_id: "toolu_2" }), STAMP);
    assert.equal(first.tool.result_hash, second.tool.result_hash);
    const failed = buildEvent(toolPayload({ hook_event_name: "PostToolUseFailure" }), STAMP);
    assert.equal(failed.tool.is_error, true);
  });

  void test("records compaction triggers and subagent types", () => {
    const compact = buildEvent(
      { hook_event_name: "PreCompact", session_id: "s", trigger: "auto" },
      STAMP,
    );
    assert.deepEqual(compact.compaction, { trigger: "auto" });
    const sub = buildEvent(
      { hook_event_name: "SubagentStop", session_id: "s", agent_type: "search" },
      STAMP,
    );
    assert.deepEqual(sub.subagent, { agent_type: "search" });
  });

  void test("ignores events it does not track", () => {
    assert.equal(buildEvent({ hook_event_name: "Notification" }, STAMP), null);
    assert.equal(buildEvent(null, STAMP), null);
  });

  void test("reads the telemetry directory from the policy-named variable", () => {
    assert.equal(telemetryDir(POLICY, { [POLICY.telemetryDirEnv]: "/tmp/x" }), "/tmp/x");
  });
});

void describe("budget transitions", () => {
  const advice = (previousBand, tokens) => budgetAdvice({ previousBand, tokens, policy: POLICY });

  void test("speaks only when the band rises", () => {
    assert.equal(advice(0, POLICY.contextAdvisorTokens - 1).message, "");
    const first = advice(0, POLICY.contextAdvisorTokens);
    assert.equal(first.band, 1);
    assert.notEqual(first.message, "");
    assert.equal(advice(1, POLICY.contextAdvisorTokens + 5000).message, "");
    assert.equal(advice(1, POLICY.contextWarnTokens).band, 2);
    assert.equal(advice(2, POLICY.contextBlockTokens).band, 3);
  });

  void test("the first band says the handoff is due at the warn cap, not at that band", () => {
    const { message } = advice(0, POLICY.contextAdvisorTokens);
    assert.match(message, /keep working/iu);
    assert.ok(message.includes(`${POLICY.contextWarnTokens / 1000}k`));
  });

  void test("stays silent when it falls, and re-arms after the band resets", () => {
    assert.equal(advice(3, POLICY.contextAdvisorTokens).message, "");
    assert.notEqual(advice(0, POLICY.contextWarnTokens).message, "");
  });

  void test("is silent when context is unknown", () => {
    assert.deepEqual(advice(0, null), { band: 0, message: "" });
  });
});

void describe("hook process", () => {
  const run = (payload, dir) =>
    spawnSync(process.execPath, [HOOK], {
      input: typeof payload === "string" ? payload : JSON.stringify(payload),
      encoding: "utf8",
      env: { ...process.env, [POLICY.telemetryDirEnv]: dir },
    });
  const events = (dir, session) =>
    readFileSync(join(dir, `${session}.events.jsonl`), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

  void test("appends one event per call and warns once per band crossing", () => {
    const dir = mkdtempSync(join(sandbox, "run-"));
    const low = transcriptWith("low.jsonl", POLICY.contextAdvisorTokens - 10);
    const high = transcriptWith("high.jsonl", POLICY.contextAdvisorTokens + 10);
    assert.equal(run(toolPayload({ transcript_path: low }), dir).stdout, "");
    const crossing = run(toolPayload({ transcript_path: high }), dir);
    assert.equal(crossing.status, 0);
    assert.match(
      JSON.parse(crossing.stdout).hookSpecificOutput.additionalContext,
      /Context budget/u,
    );
    assert.equal(run(toolPayload({ transcript_path: high }), dir).stdout, "");
    assert.equal(events(dir, "sess-1").length, 3);
  });

  void test("a compaction resets the band so the next crossing warns again", () => {
    const dir = mkdtempSync(join(sandbox, "run-"));
    const high = transcriptWith("high2.jsonl", POLICY.contextAdvisorTokens + 10);
    assert.notEqual(run(toolPayload({ transcript_path: high }), dir).stdout, "");
    run({ hook_event_name: "PreCompact", session_id: "sess-1", trigger: "auto" }, dir);
    assert.notEqual(run(toolPayload({ transcript_path: high }), dir).stdout, "");
  });

  void test("fails open on malformed input and unreadable transcripts", () => {
    const dir = mkdtempSync(join(sandbox, "run-"));
    assert.equal(run("not json", dir).status, 0);
    const missing = run(toolPayload({ transcript_path: join(sandbox, "missing.jsonl") }), dir);
    assert.equal(missing.status, 0);
    assert.equal(missing.stdout, "");
  });
});
