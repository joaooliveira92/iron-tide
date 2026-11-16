import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

import { isPollCommand, trailingPollLength } from "../lib/poll-chain.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const HOOK = join(ROOT, "scripts/hooks/pre-tool-use-bash.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);

const bash = (command, id = command) =>
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
  });
const other = (name) =>
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", id: name, name, input: {} }] },
  });
const PEEK = "tail -c 300 /tmp/gate.log; date";

void describe("isPollCommand", () => {
  void test("recognises log peeks and process checks", () => {
    assert.equal(isPollCommand(PEEK), true);
    assert.equal(isPollCommand("tail -n 20 build/out.log"), true);
    assert.equal(isPollCommand("ps -axo pid,etime,command | rg 'pnpm|vitest'"), true);
    assert.equal(isPollCommand("sleep 5; wc -l /tmp/gate.log"), true);
  });
  void test("ignores commands that do real work", () => {
    assert.equal(isPollCommand("pnpm heavy pnpm check > /tmp/gate.log 2>&1"), false);
    assert.equal(isPollCommand("tail -n 20 src/a.ts"), false);
    assert.equal(isPollCommand("git status && tail -n 5 /tmp/gate.log"), false);
    assert.equal(isPollCommand(""), false);
  });
});

void describe("trailingPollLength", () => {
  const length = (lines, current) => trailingPollLength({ lines, currentToolUseId: current });
  void test("counts consecutive polls", () => {
    assert.equal(length([bash(PEEK, "a"), bash(PEEK, "b"), bash(PEEK, "c")]), 3);
  });
  void test("any other tool call resets the chain", () => {
    assert.equal(length([bash(PEEK, "a"), other("t3_background_wait"), bash(PEEK, "b")]), 1);
    assert.equal(length([bash(PEEK, "a"), bash("pnpm test", "b"), bash(PEEK, "c")]), 1);
  });
  void test("excludes the current tool call and skips malformed lines", () => {
    assert.equal(length([bash(PEEK, "a"), "not json", "", bash(PEEK, "now")], "now"), 1);
  });
});

void describe("hook deny on the fourth consecutive poll", () => {
  let sandbox;
  let transcript;

  before(() => {
    mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
    sandbox = mkdtempSync(join(ROOT, "node_modules/.cache", "poll-chain-"));
    transcript = join(sandbox, "session.jsonl");
    mkdirSync(join(sandbox, "session", "subagents"), { recursive: true });
  });
  after(() => rmSync(sandbox, { recursive: true, force: true }));

  const history = (count) => Array.from({ length: count }, (_, k) => bash(PEEK, `p${k}`));
  const run = (command, lines, extra = {}, subagentLines = null) => {
    writeFileSync(transcript, lines.map((line) => `${line}\n`).join(""));
    if (subagentLines !== null) {
      writeFileSync(
        join(sandbox, "session", "subagents", "agent-abc123.jsonl"),
        subagentLines.map((line) => `${line}\n`).join(""),
      );
    }
    const result = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({
        tool_name: "Bash",
        cwd: sandbox,
        transcript_path: transcript,
        tool_use_id: "now",
        tool_input: { command },
        ...extra,
      }),
      encoding: "utf8",
      env: { ...process.env, [POLICY.guardAuditLogEnv]: join(sandbox, "overrides.log") },
    });
    return { status: result.status, stdout: result.stdout };
  };

  void test("allows the third poll", () => {
    const result = run(PEEK, history(POLICY.pollChainDenyAt - 2));
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
  void test("denies the fourth with a permissionDecision payload", () => {
    const result = run(PEEK, history(POLICY.pollChainDenyAt - 1));
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.permissionDecision, "deny");
    assert.match(output.permissionDecisionReason, /run_in_background/u);
    assert.match(output.permissionDecisionReason, /agent-guard: allow/u);
  });
  void test("allows a non-poll command after a chain", () => {
    const result = run("pnpm test", history(POLICY.pollChainDenyAt));
    assert.equal(result.stdout, "");
  });
  void test("an audited override lets the poll through", () => {
    const result = run(
      `${PEEK} # agent-guard: allow need one more look`,
      history(POLICY.pollChainDenyAt),
    );
    assert.equal(result.stdout, "");
  });
  void test("a subagent is judged by its own transcript, not the parent's", () => {
    const own = history(POLICY.pollChainDenyAt - 1);
    const denied = run(PEEK, [bash("pnpm test", "x")], { agent_id: "abc123" }, own);
    assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, "deny");
    const allowed = run(PEEK, history(POLICY.pollChainDenyAt), { agent_id: "abc123" }, [
      bash("pnpm test", "y"),
    ]);
    assert.equal(allowed.stdout, "");
  });
  void test("fails open when the subagent transcript is missing", () => {
    const result = run(PEEK, history(POLICY.pollChainDenyAt), { agent_id: "nope" });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
});
