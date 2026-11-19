import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";

import { evaluateAgentRouting, evaluateReadRouting } from "../lib/agent-routing.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);
const HOOK = join(ROOT, "scripts/hooks/pre-tool-use-routing.mjs");

const runHook = (payload) =>
  spawnSync(process.execPath, [HOOK], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
  });

void describe("agent routing", () => {
  test("denies the general-purpose subagent type", () => {
    const verdict = evaluateAgentRouting({
      input: { subagent_type: "general-purpose", prompt: "look around" },
      policy: POLICY,
    });
    assert.equal(verdict.decision, "block");
    assert.match(verdict.message, /general-purpose/u);
  });

  test("denies an Agent call without subagent_type, which defaults to general-purpose", () => {
    const verdict = evaluateAgentRouting({ input: { prompt: "look around" }, policy: POLICY });
    assert.equal(verdict.decision, "block");
  });

  test("allows named specialised agents and fork", () => {
    for (const subagent_type of [
      "search",
      "grep",
      "audit",
      "runner",
      "Explore",
      "claude",
      "fork",
    ]) {
      assert.deepEqual(
        evaluateAgentRouting({ input: { subagent_type, prompt: "x" }, policy: POLICY }),
        { decision: "allow" },
        subagent_type,
      );
    }
  });

  test("ignores a subagent_type that only contains the denied name", () => {
    assert.deepEqual(
      evaluateAgentRouting({ input: { subagent_type: "general-purpose-lite" }, policy: POLICY }),
      { decision: "allow" },
    );
  });
});

void describe("read routing", () => {
  const denied = [
    "/repo/golden/replays/seed-1.json",
    "/repo/.ai/reports/agent-efficiency-2026-11-01.md",
    "/repo/pnpm-lock.yaml",
  ];

  test("denies full reads of replays, reports and the lockfile", () => {
    for (const file_path of denied) {
      const verdict = evaluateReadRouting({ input: { file_path }, policy: POLICY });
      assert.equal(verdict.decision, "block", file_path);
      assert.match(verdict.message, /offset|rg -n/u);
    }
  });

  test("allows ranged reads of the same files", () => {
    for (const file_path of denied) {
      assert.deepEqual(
        evaluateReadRouting({ input: { file_path, offset: 10, limit: 40 }, policy: POLICY }),
        { decision: "allow" },
        file_path,
      );
      assert.deepEqual(
        evaluateReadRouting({ input: { file_path, limit: 120 }, policy: POLICY }),
        { decision: "allow" },
        file_path,
      );
    }
  });

  test("allows ordinary files and look-alike paths", () => {
    for (const file_path of [
      "/repo/golden/replay-approvals/legacy.json",
      "/repo/src/reports.ts",
      "/repo/docs/agents/replay-corpus.md",
      "/repo/pnpm-lock.yaml.bak",
    ]) {
      assert.deepEqual(
        evaluateReadRouting({ input: { file_path }, policy: POLICY }),
        {
          decision: "allow",
        },
        file_path,
      );
    }
  });

  test("allows a read without a file_path", () => {
    assert.deepEqual(evaluateReadRouting({ input: {}, policy: POLICY }), { decision: "allow" });
  });
});

void describe("routing hook", () => {
  test("blocks the general-purpose agent with exit 2 and a stderr message", () => {
    const result = runHook({
      tool_name: "Agent",
      tool_input: { subagent_type: "general-purpose", prompt: "x" },
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /general-purpose/u);
  });

  test("allows a named agent", () => {
    const result = runHook({
      tool_name: "Agent",
      tool_input: { subagent_type: "search", prompt: "x" },
    });
    assert.equal(result.status, 0);
  });

  test("blocks a full read of the lockfile and allows a ranged one", () => {
    const full = runHook({
      tool_name: "Read",
      tool_input: { file_path: "/repo/pnpm-lock.yaml" },
    });
    assert.equal(full.status, 2);
    const ranged = runHook({
      tool_name: "Read",
      tool_input: { file_path: "/repo/pnpm-lock.yaml", offset: 1, limit: 120 },
    });
    assert.equal(ranged.status, 0);
  });

  test("fails open on unreadable input", () => {
    assert.equal(runHook("not json").status, 0);
  });
});
