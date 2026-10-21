// Tests for scripts/verify-reachability-ledger.mjs: the reachability ledger gate.
// Validates entry structure, file existence for reachable rows, dormant citation
// requirements, CAMPAIGN_COMMAND_NAMES coverage, and export classification.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateLedger,
  extractExports,
  validateEntry,
  verifyReachableFiles,
  classifyCommands,
} from "../verify-reachability-ledger.mjs";

const EMPTY_LEDGER = { version: 1, capabilities: [] };
const NOOP_READ = () => undefined;
const NOOP_EXISTS = () => true;

void test("empty ledger passes", () => {
  const r = evaluateLedger({
    ledger: EMPTY_LEDGER,
    readCombatIndex: undefined,
    readPhaseEngineIndex: undefined,
    readCommandContract: NOOP_READ,
    pathExists: NOOP_EXISTS,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, {
    reachable: 0,
    "dormant-by-decision": 0,
    internal: 0,
    unclassified: 0,
  });
});

void test("reachable row passes when screen exists", () => {
  const ledger = {
    version: 1,
    capabilities: [
      {
        id: "test-cmd",
        description: "test",
        engine_entry: "test",
        engine_package: "phase-engine",
        main_commands: [],
        renderer_screen: "shell/App.tsx",
        status: "reachable",
      },
    ],
  };
  const r = evaluateLedger({
    ledger,
    readCombatIndex: undefined,
    readPhaseEngineIndex: undefined,
    readCommandContract: NOOP_READ,
    pathExists: (p) => p.endsWith("shell/App.tsx"),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, {
    reachable: 1,
    "dormant-by-decision": 0,
    internal: 0,
    unclassified: 0,
  });
});

void test("reachable row fails when screen is missing", () => {
  const ledger = {
    version: 1,
    capabilities: [
      {
        id: "test-cmd",
        description: "test",
        engine_entry: "test",
        engine_package: "phase-engine",
        main_commands: [],
        renderer_screen: "screens/missing/DoesNotExist.tsx",
        status: "reachable",
      },
    ],
  };
  const r = evaluateLedger({
    ledger,
    readCombatIndex: undefined,
    readPhaseEngineIndex: undefined,
    readCommandContract: NOOP_READ,
    pathExists: () => false,
  });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /test-cmd.*renderer_screen.*not found/u);
});

void test("dormant-by-decision without citation fails", () => {
  const problems = validateEntry(
    { id: "test", status: "dormant-by-decision", engine_package: "phase-engine" },
    0,
    new Set(),
  );
  assert.ok(problems.some((p) => p.includes("dormant-by-decision") && p.includes("adr_or_issue")));
});

void test("dormant-by-decision with citation passes", () => {
  const problems = validateEntry(
    {
      id: "test",
      status: "dormant-by-decision",
      adr_or_issue: "#1",
      engine_package: "phase-engine",
    },
    0,
    new Set(),
  );
  assert.equal(problems.length, 0);
});

void test("invalid status fails", () => {
  const problems = validateEntry(
    { id: "test", status: "bogus", engine_package: "phase-engine" },
    0,
    new Set(),
  );
  assert.ok(problems.some((p) => p.includes("bogus")));
});

void test("missing id fails", () => {
  const problems = validateEntry(
    { status: "internal", engine_package: "phase-engine" },
    0,
    new Set(),
  );
  assert.ok(problems.some((p) => p.includes("missing or empty id")));
});

void test("duplicate id fails", () => {
  const seen = new Set(["test"]);
  const problems = validateEntry(
    { id: "test", status: "internal", engine_package: "phase-engine" },
    0,
    seen,
  );
  assert.ok(problems.some((p) => p.includes("duplicate id")));
});

void test("unclassified status fails", () => {
  const problems = validateEntry(
    { id: "test", status: "unclassified", engine_package: "phase-engine" },
    0,
    new Set(),
  );
  assert.ok(problems.some((p) => p.includes("unclassified")));
});

void test("extractExports captures star re-exports", () => {
  const src = `export * from "./gunnery/index.js";\nexport * from "./torpedoes.js";\n`;
  const names = extractExports(src);
  assert.deepEqual(names, ["gunnery/index.js", "torpedoes.js"]);
});

void test("extractExports ignores named exports", () => {
  const src = `export { BattleResolver } from "./resolver.js";\nexport * from "./mines/index.js";\n`;
  const names = extractExports(src);
  assert.deepEqual(names, ["mines/index.js"]);
});

void test("classifyCommands finds unreferenced commands", () => {
  const caps = [
    { id: "c1", main_commands: ["cmdA", "cmdB"] },
    { id: "c2", main_commands: ["cmdC"] },
  ];
  const names = ["cmdA", "cmdB", "cmdC", "cmdUnused"];
  const { referenced, unreferenced } = classifyCommands(names, caps);
  assert.deepEqual(referenced, ["cmdA", "cmdB", "cmdC"]);
  assert.deepEqual(unreferenced, ["cmdUnused"]);
});

void test("unreferenced command names fail the gate", () => {
  const ledger = {
    version: 1,
    capabilities: [
      {
        id: "c1",
        description: "test",
        engine_entry: "test",
        engine_package: "phase-engine",
        main_commands: ["cmdA"],
        renderer_screen: null,
        status: "internal",
      },
    ],
  };
  const readCommandContract = () => `"cmdA",\n"cmdUnused",\n`;
  const r = evaluateLedger({
    ledger,
    readCombatIndex: undefined,
    readPhaseEngineIndex: undefined,
    readCommandContract,
    pathExists: () => true,
  });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /cmdUnused.*not referenced/u);
});

void test("unclassified combat export fails the gate", () => {
  const ledger = {
    version: 1,
    capabilities: [
      {
        id: "c1",
        description: "test",
        engine_entry: "gunnery",
        engine_package: "combat",
        main_commands: [],
        renderer_screen: null,
        status: "internal",
      },
    ],
  };
  const readCombatIndex = () =>
    `export * from "./gunnery/index.js";\nexport * from "./unclassified.js";\n`;
  const r = evaluateLedger({
    ledger,
    readCombatIndex,
    readPhaseEngineIndex: undefined,
    readCommandContract: NOOP_READ,
    pathExists: () => true,
  });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /unclassified.*not classified/u);
});

void test("reachable row passes with null renderer_screen", () => {
  const problems = verifyReachableFiles({
    id: "test",
    status: "reachable",
    renderer_screen: null,
    evidence_test: null,
  });
  assert.equal(problems.length, 0);
});

void test("unknown engine_package fails", () => {
  const ledger = {
    version: 1,
    capabilities: [
      {
        id: "test",
        description: "test",
        engine_entry: "test",
        engine_package: "unknown-pkg",
        main_commands: [],
        renderer_screen: null,
        status: "internal",
      },
    ],
  };
  const r = evaluateLedger({
    ledger,
    readCombatIndex: undefined,
    readPhaseEngineIndex: undefined,
    readCommandContract: NOOP_READ,
    pathExists: () => true,
  });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /unknown-pkg/u);
});
