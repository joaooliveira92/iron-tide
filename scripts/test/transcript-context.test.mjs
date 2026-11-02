import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

import {
  contextTokensOf,
  evaluatePrompt,
  latestContext,
  readTail,
} from "../lib/transcript-context.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const HOOK = join(ROOT, "scripts/hooks/user-prompt-context.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);
const NOW = Date.parse("2026-11-02T12:00:00Z");

const usage = (tokens) => ({
  input_tokens: 2,
  cache_read_input_tokens: tokens - 2,
  cache_creation_input_tokens: 0,
});
const assistant = (tokens, timestamp, extra = {}) =>
  JSON.stringify({
    type: "assistant",
    timestamp,
    message: { model: "claude-sonnet-5-5", usage: { ...usage(tokens), ...extra } },
  });

let sandbox;
const writeTranscript = (name, records) => {
  const path = join(sandbox, name);
  writeFileSync(path, `${records.join("\n")}\n`);
  return path;
};

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "ctx-hook-"));
});
after(() => rmSync(sandbox, { recursive: true, force: true }));

describe("context measurement", () => {
  test("uses the last main-model iteration, not the advisor-inflated top-level usage", () => {
    const inflated = {
      input_tokens: 4,
      cache_read_input_tokens: 885314,
      cache_creation_input_tokens: 3161,
      iterations: [
        {
          type: "message",
          input_tokens: 2,
          cache_read_input_tokens: 443597,
          cache_creation_input_tokens: 0,
        },
        {
          type: "advisor_message",
          input_tokens: 2,
          cache_read_input_tokens: 445969,
          cache_creation_input_tokens: 0,
        },
        {
          type: "message",
          input_tokens: 2,
          cache_read_input_tokens: 444878,
          cache_creation_input_tokens: 0,
        },
      ],
    };
    assert.equal(contextTokensOf(inflated), 444880);
  });
  test("skips synthetic and sidechain records and reports the latest activity", () => {
    const lines = [
      assistant(120000, "2026-11-02T10:00:00Z"),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-11-02T10:05:00Z",
        message: { model: "<synthetic>", usage: usage(0) },
      }),
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        timestamp: "2026-11-02T10:06:00Z",
        message: { model: "m", usage: usage(5) },
      }),
      "{broken",
    ];
    const { tokens, lastActivityMs } = latestContext(lines);
    assert.equal(tokens, 120000);
    assert.equal(lastActivityMs, Date.parse("2026-11-02T10:05:00Z"));
  });
  test("readTail drops the partial first line when truncating", () => {
    const path = writeTranscript("tail.jsonl", [
      assistant(1, "2026-11-02T10:00:00Z"),
      assistant(2, "2026-11-02T10:01:00Z"),
    ]);
    assert.equal(readTail(path, 40).length >= 1, true);
    assert.equal(latestContext(readTail(path, 4096)).tokens, 2);
  });
});

describe("prompt policy", () => {
  const decide = (tokens, prompt, idleMinutes = 1) =>
    evaluatePrompt({
      prompt,
      tokens,
      lastActivityMs: NOW - idleMinutes * 60000,
      nowMs: NOW,
      policy: POLICY,
    }).action;
  test("is silent below the advisor band", () => assert.equal(decide(99000, "go"), "none"));
  test("advises, then warns, as context grows", () => {
    assert.equal(decide(POLICY.contextAdvisorTokens, "go"), "advise");
    assert.equal(decide(POLICY.contextWarnTokens, "go"), "warn");
  });
  test("blocks a resume above the block limit, by phrase or idle gap", () => {
    assert.equal(decide(POLICY.contextBlockTokens, "Continue where you left off."), "block");
    assert.equal(decide(POLICY.contextBlockTokens, "next task", POLICY.idleResumeMinutes), "block");
    assert.equal(decide(POLICY.contextBlockTokens, "next task", 5), "warn");
  });
  test("honours the explicit override and the handoff exemptions", () => {
    assert.equal(
      decide(POLICY.contextBlockTokens, `continue ${POLICY.contextOverrideToken} urgent fix`),
      "warn",
    );
    assert.equal(decide(POLICY.contextBlockTokens, "/handoff next session", 600), "none");
  });
  test("is silent when the context is unknown", () =>
    assert.equal(
      evaluatePrompt({
        prompt: "x",
        tokens: null,
        lastActivityMs: null,
        nowMs: NOW,
        policy: POLICY,
      }).action,
      "none",
    ));
});

describe("hook process", () => {
  const run = (payload) => {
    const stdin = typeof payload === "string" ? payload : JSON.stringify(payload);
    return spawnSync(process.execPath, [HOOK], { input: stdin, encoding: "utf8" });
  };
  test("injects additional context in the warn band", () => {
    const transcript = writeTranscript("warn.jsonl", [
      assistant(POLICY.contextWarnTokens + 5, new Date().toISOString()),
    ]);
    const result = run({ transcript_path: transcript, prompt: "next step" });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.match(out.hookSpecificOutput.additionalContext, /\/handoff/u);
  });
  test("blocks a resume prompt above the limit with exit 2", () => {
    const transcript = writeTranscript("block.jsonl", [
      assistant(POLICY.contextBlockTokens + 5, new Date().toISOString()),
    ]);
    const result = run({ transcript_path: transcript, prompt: "Continue where you left off." });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /fresh session/u);
  });
  test("fails open on malformed input, a missing transcript, or no path", () => {
    for (const payload of [
      "",
      "nope",
      "{}",
      { transcript_path: join(sandbox, "missing.jsonl"), prompt: "x" },
    ]) {
      assert.equal(run(payload).status, 0);
    }
  });
});
