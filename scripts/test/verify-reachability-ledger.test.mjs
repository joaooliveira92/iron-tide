// Tests for scripts/verify-reachability-ledger.mjs: the reachability ledger gate
// (ADR-0267). The gate is pure over a `repo` port, so each test builds a small
// in-memory repository and asserts on the problems the gate reports.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkReportFresh,
  evaluateLedger,
  extractApplyVerbs,
  extractCommandNames,
  extractDebugOnlyScreens,
  extractModuleKeys,
  renderReport,
  validateLedgerShape,
} from "../verify-reachability-ledger.mjs";

const CONTRACT = `export const campaignCommandShapes = {\n  alpha: command(NO_PAYLOAD, resultType<A>()),\n  beta: command(NO_PAYLOAD, resultType<B>()),\n} as const;\n`;
const BRIDGE = `export const commandPrograms = {\n  alpha: alphaProgram,\n  beta: betaProgram,\n};\n`;
const REGISTRY = `const DBG: X = { id: "dbg-screen" };
const MAP: X = { id: "proto" };
export const R = [ { id: "live" }, ...(DEBUG_MODE ? [DBG] : []), ...(import.meta.env.DEV ? [MAP] : []) ];`;

/** Base files for a tiny repository where "alpha" is genuinely reachable. */
function baseFiles() {
  return {
    "apps/desktop/src/shared/campaign-command-descriptors.ts": CONTRACT,
    "apps/desktop/src/main/campaignBridge.ts": BRIDGE,
    "apps/desktop/src/renderer/shell/campaign-screen-registry.tsx": REGISTRY,
    "apps/desktop/src/renderer/screens/live/LiveScreen.tsx": `bridge.campaign.execute("alpha", id)`,
    "apps/desktop/src/renderer/screens/live/LiveScreen.test.tsx": `import "./LiveScreen"; // alpha`,
    "apps/desktop/src/renderer/screens/dbg-screen/Dbg.tsx": `execute("beta")`,
    "packages/combat/src/index.ts": `export * from "./gunnery/index.js";\nexport * from "./air/index.js";\nexport { X } from "./resolver.js";\n`,
    "packages/combat/src/gunnery/index.ts": "",
    "packages/combat/src/smoke/index.ts": "",
    "packages/combat/src/resolver.ts": "",
    "packages/phase-engine/src/index.ts": `export { MonthExecutor } from "./month.js";\n`,
    "packages/phase-engine/src/month.ts": "",
    "packages/phase-engine/src/commands.ts": `export function applyDoThing(a) {}\nexport function applyOther(a) {}\nexport function notAVerb() {}\n`,
    "docs/adr/ADR-0001-x.md": "# x",
  };
}

/** @param {Record<string,string>} files */
function fakeRepo(files) {
  return {
    exists: (p) => Object.hasOwn(files, p) || Object.keys(files).some((f) => f.startsWith(`${p}/`)),
    read: (p) => files[p],
    list: (dir) => Object.keys(files).filter((f) => f.startsWith(`${dir}/`)),
  };
}

const row = (over) => ({
  id: "row",
  player_verb: "do a thing",
  status: "internal",
  engine_package: "phase-engine",
  engine_modules: [],
  engine_symbols: [],
  main_commands: [],
  renderer_screen: null,
  evidence_test: null,
  adr_or_issue: null,
  ...over,
});

const reachableRow = (over) =>
  row({
    id: "alpha-row",
    status: "reachable",
    engine_symbols: ["applyDoThing"],
    main_commands: ["alpha"],
    renderer_screen: "screens/live/LiveScreen.tsx",
    evidence_test: "apps/desktop/src/renderer/screens/live/LiveScreen.test.tsx",
    ...over,
  });

/** A ledger that classifies everything in baseFiles(). */
function goodLedger(extra = []) {
  return {
    version: 2,
    capabilities: [
      reachableRow(),
      row({ id: "other", engine_symbols: ["applyOther"], main_commands: ["beta"] }),
      row({ id: "pe-month", engine_modules: ["month"] }),
      row({ id: "cb-gun", engine_package: "combat", engine_modules: ["gunnery", "resolver"] }),
      row({
        id: "cb-air",
        engine_package: "combat",
        status: "dormant-by-decision",
        engine_modules: ["air", "smoke"],
        adr_or_issue: "#225",
      }),
      ...extra,
    ],
  };
}

function run(ledger, mutate = (f) => f) {
  return evaluateLedger({ ledger, repo: fakeRepo(mutate(baseFiles())) });
}

const has = (r, fragment) => r.problems.some((p) => p.includes(fragment));

void test("a fully classified ledger passes and counts per status", () => {
  const r = run(goodLedger());
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.counts, {
    reachable: 1,
    "dormant-by-decision": 1,
    internal: 3,
    unclassified: 0,
  });
});

void test("extractors read commands, module keys, apply verbs and debug-only screens", () => {
  assert.deepEqual(extractCommandNames(CONTRACT), ["alpha", "beta"]);
  assert.deepEqual([...extractModuleKeys(baseFiles()["packages/combat/src/index.ts"])].sort(), [
    "air",
    "gunnery",
    "resolver",
  ]);
  assert.deepEqual(
    [...extractApplyVerbs(baseFiles()["packages/phase-engine/src/commands.ts"])].sort(),
    ["applyDoThing", "applyOther"],
  );
  assert.deepEqual([...extractDebugOnlyScreens(REGISTRY)].sort(), ["dbg-screen", "proto"]);
});

void test("shape: unknown keys, bad status, bad id and duplicates are rejected", () => {
  assert.ok(validateLedgerShape({ version: 2, capabilities: [row({ surprise: 1 })] }).length > 0);
  assert.ok(
    validateLedgerShape({ version: 2, capabilities: [row({ status: "maybe" })] }).length > 0,
  );
  assert.ok(validateLedgerShape({ version: 2, capabilities: [row({ id: "" })] }).length > 0);
  assert.ok(
    validateLedgerShape({ version: 2, capabilities: [row(), row()] }).some((p) =>
      p.includes("duplicate"),
    ),
  );
  assert.ok(validateLedgerShape({ version: 1, capabilities: [] }).length > 0);
  assert.deepEqual(validateLedgerShape({ version: 2, capabilities: [row()] }), []);
});

void test("unclassified rows fail the gate", () => {
  const r = run(goodLedger([row({ id: "tbd", status: "unclassified" })]));
  assert.ok(has(r, "tbd") && has(r, "unclassified"));
});

void test("a new combat module that no row classifies fails", () => {
  const r = run(goodLedger(), (f) => ({ ...f, "packages/combat/src/torpedoes/index.ts": "" }));
  assert.ok(has(r, 'combat module "torpedoes"'));
});

void test("a new exported index module in phase-engine that no row classifies fails", () => {
  const r = run(goodLedger(), (f) => ({
    ...f,
    "packages/phase-engine/src/index.ts": `${f["packages/phase-engine/src/index.ts"]}export { z } from "./newThing.js";\n`,
  }));
  assert.ok(has(r, 'phase-engine module "newThing"'));
});

void test("a new apply verb that no row classifies fails", () => {
  const r = run(goodLedger(), (f) => ({
    ...f,
    "packages/phase-engine/src/commands.ts": `${f["packages/phase-engine/src/commands.ts"]}export function applyBrandNew() {}\n`,
  }));
  assert.ok(has(r, 'phase-engine verb "applyBrandNew"'));
});

void test("substring names do not count as classification", () => {
  const ledger = goodLedger();
  ledger.capabilities = ledger.capabilities.filter((c) => c.id !== "cb-gun");
  ledger.capabilities.push(
    row({ id: "cb-gunnery-x", engine_package: "combat", engine_modules: ["gunnery-extra"] }),
  );
  const r = run(ledger);
  assert.ok(has(r, 'combat module "gunnery"'));
  assert.ok(has(r, '"gunnery-extra" does not exist'));
});

void test("a ledger entry naming a module or verb that no longer exists fails", () => {
  const r = run(goodLedger([row({ id: "ghost", engine_symbols: ["applyGone"] })]));
  assert.ok(has(r, '"applyGone" does not exist'));
});

void test("a CAMPAIGN_COMMAND_NAMES entry no row references fails", () => {
  const r = run(goodLedger(), (f) => ({
    ...f,
    "apps/desktop/src/shared/campaign-command-descriptors.ts": CONTRACT.replace(
      "  beta: command(NO_PAYLOAD, resultType<B>()),\n",
      "  beta: command(NO_PAYLOAD, resultType<B>()),\n  gamma: command(NO_PAYLOAD, resultType<G>()),\n",
    ),
  }));
  assert.ok(has(r, 'command "gamma"'));
});

void test("a row citing a command that is not in CAMPAIGN_COMMAND_NAMES fails", () => {
  const r = run(goodLedger([row({ id: "bad-cmd", main_commands: ["nope"] })]));
  assert.ok(has(r, '"nope" is not in CAMPAIGN_COMMAND_NAMES'));
});

void test("reachable requires a renderer screen, and removing it fails", () => {
  const noScreen = run(goodLedger(), (f) => f);
  assert.deepEqual(noScreen.problems, []);
  const missing = goodLedger();
  missing.capabilities[0] = reachableRow({ renderer_screen: null });
  assert.ok(has(run(missing), "reachable requires renderer_screen"));
  const gone = run(goodLedger(), (f) => {
    const { ["apps/desktop/src/renderer/screens/live/LiveScreen.tsx"]: _drop, ...rest } = f;
    return rest;
  });
  assert.ok(has(gone, "renderer_screen"));
});

void test("reachable requires commands, an existing registered handler and a renderer call site", () => {
  const noCmd = goodLedger();
  noCmd.capabilities[0] = reachableRow({ main_commands: [] });
  assert.ok(has(run(noCmd), "reachable requires at least one main command"));

  const noHandler = run(goodLedger(), (f) => ({
    ...f,
    "apps/desktop/src/main/campaignBridge.ts": BRIDGE.replace("alpha: alphaProgram,", ""),
  }));
  assert.ok(has(noHandler, 'command "alpha" has no handler'));

  const noCaller = run(goodLedger(), (f) => ({
    ...f,
    "apps/desktop/src/renderer/screens/live/LiveScreen.tsx": "export {}",
  }));
  assert.ok(has(noCaller, 'command "alpha" is never called'));

  const testOnlyCaller = run(goodLedger(), (f) => ({
    ...f,
    "apps/desktop/src/renderer/screens/live/LiveScreen.tsx": "export {}",
    "apps/desktop/src/renderer/screens/live/x.test.ts": `execute("alpha")`,
  }));
  assert.ok(has(testOnlyCaller, 'command "alpha" is never called'));
});

void test("reachable requires an existing test as evidence that cites the path", () => {
  const none = goodLedger();
  none.capabilities[0] = reachableRow({ evidence_test: null });
  assert.ok(has(run(none), "reachable requires evidence_test"));

  const missing = goodLedger();
  missing.capabilities[0] = reachableRow({ evidence_test: "apps/x/Missing.test.ts" });
  assert.ok(has(run(missing), "evidence_test"));

  const notATest = goodLedger();
  notATest.capabilities[0] = reachableRow({
    evidence_test: "apps/desktop/src/renderer/screens/live/LiveScreen.tsx",
  });
  assert.ok(has(run(notATest), "is not a test file"));

  const unrelated = run(goodLedger(), (f) => ({
    ...f,
    "apps/desktop/src/renderer/screens/live/LiveScreen.test.tsx": "// nothing relevant",
  }));
  assert.ok(has(unrelated, "does not mention"));
});

void test("a debug-only or dev-only screen cannot be the path of a reachable row", () => {
  const dbg = goodLedger();
  dbg.capabilities[0] = reachableRow({
    main_commands: ["beta"],
    renderer_screen: "screens/dbg-screen/Dbg.tsx",
    evidence_test: "apps/desktop/src/renderer/screens/live/LiveScreen.test.tsx",
  });
  dbg.capabilities[1] = row({
    id: "other",
    engine_symbols: ["applyOther"],
    main_commands: ["alpha"],
  });
  const r = run(dbg);
  assert.ok(has(r, "debug-only or dev-only"));
});

void test("dormant-by-decision needs an ADR or issue citation that resolves", () => {
  const none = goodLedger([
    row({ id: "d1", status: "dormant-by-decision", adr_or_issue: null, engine_symbols: [] }),
  ]);
  assert.ok(has(run(none), "dormant-by-decision requires adr_or_issue"));
  const badFormat = goodLedger([
    row({ id: "d2", status: "dormant-by-decision", adr_or_issue: "someday" }),
  ]);
  assert.ok(has(run(badFormat), "must cite"));
  const missingAdr = goodLedger([
    row({ id: "d3", status: "dormant-by-decision", adr_or_issue: "ADR-9999" }),
  ]);
  assert.ok(has(run(missingAdr), "ADR-9999"));
  const okAdr = goodLedger([
    row({ id: "d4", status: "dormant-by-decision", adr_or_issue: "ADR-0001" }),
  ]);
  assert.deepEqual(run(okAdr).problems, []);
});

void test("only dormant rows carry a citation, and internal rows carry no screen", () => {
  const r = run(goodLedger([row({ id: "i1", adr_or_issue: "#1" })]));
  assert.ok(has(r, "adr_or_issue is only valid"));
  const s = run(goodLedger([row({ id: "i2", renderer_screen: "screens/live/LiveScreen.tsx" })]));
  assert.ok(has(s, "only reachable rows may set renderer_screen"));
});

void test("renderReport lists counts and every row, deterministically", () => {
  const ledger = goodLedger();
  const a = renderReport(ledger);
  assert.equal(a, renderReport(ledger));
  assert.match(a, /\| reachable \| 1 \|/);
  assert.match(a, /alpha-row/);
  assert.match(a, /#225/);
});

void test("the generated report must match the ledger", () => {
  const ledger = goodLedger();
  assert.deepEqual(checkReportFresh(ledger, renderReport(ledger)), []);
  assert.equal(checkReportFresh(ledger, "stale").length, 1);
  assert.equal(checkReportFresh(ledger, undefined).length, 1);
});
