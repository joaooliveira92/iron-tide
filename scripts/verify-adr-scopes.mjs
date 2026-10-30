#!/usr/bin/env node
// Prove that every package's nearest AGENTS.md reaches the complete, current set of
// ADRs that govern it (ADR-0318). Reads each ADR's `Applies to:` line and the
// Supersedes/Amends relations, regenerates docs/adr/by-scope/*.md, and fails when a
// mapping is missing, stale or contradicts the supersession metadata.
//
// Usage: `node scripts/verify-adr-scopes.mjs [--self-test]`
// Regenerate the pages with `pnpm adr:index`. Wired into `pnpm preflight`.

import { createRequire } from "node:module";
import { resolve } from "node:path";

import { isEntryPoint } from "./lib/paths.mjs";

const require = createRequire(import.meta.url);
const lib = require("./lib/adr-scope.cjs");

const root = resolve(import.meta.dirname, "..");

export const EXEMPT = new Set(["content-codemod", "diagnostics"]);

function mutate(records, file, change) {
  return records.map((r) => (r.file === file ? { ...r, ...change } : r));
}

export function runSelfTest(repoRoot = root) {
  const universe = lib.scopeUniverse(repoRoot);
  const records = lib.loadRecords(repoRoot);
  const docs = lib.loadGoverningDocs(repoRoot, universe);
  const baseline = lib.readRuleBaseline(repoRoot);
  const current = records.find(
    (r) => r.location === "active" && r.status === "accepted" && r.appliesTo?.includes("combat"),
  );
  const superseded = records.find((r) => r.status === "superseded");
  const amended = records.find((r) => r.amendedBy.length > 0);
  const ruled = records.find((r) => r.rule !== null);
  const cycle = (number, other) => ({
    file: `ADR-${number}-cycle-fixture.md`,
    location: "active",
    number,
    title: `cycle fixture ${number}`,
    status: "superseded",
    appliesTo: ["repository"],
    rule: null,
    supersedes: [other],
    supersededBy: [other],
    amends: [],
    amendedBy: [],
    consistentWith: [],
  });
  const cases = [
    ["real corpus passes", () => lib.validateRecords(records, universe, baseline), false],
    [
      "ADR without Applies to fails",
      () =>
        lib.validateRecords(mutate(records, current.file, { appliesTo: null }), universe, baseline),
      true,
    ],
    [
      "unknown scope fails",
      () =>
        lib.validateRecords(
          mutate(records, current.file, { appliesTo: ["nowhere"] }),
          universe,
          baseline,
        ),
      true,
    ],
    [
      "broken supersession reciprocity fails",
      () =>
        lib.validateRecords(
          mutate(records, superseded.file, { supersededBy: [] }),
          universe,
          baseline,
        ),
      true,
    ],
    [
      "broken amendment reciprocity fails",
      () =>
        lib.validateRecords(mutate(records, amended.file, { amendedBy: [] }), universe, baseline),
      true,
    ],
    [
      "current record without a Rule: fails",
      () => lib.validateRecords(mutate(records, ruled.file, { rule: null }), universe, baseline),
      true,
    ],
    [
      "paid rule-baseline entry fails",
      () =>
        lib.validateRecords(
          mutate(records, current.file, { rule: "fixture rule" }),
          universe,
          new Set([...baseline, current.number]),
        ),
      true,
    ],
    [
      "supersession cycle fails",
      () =>
        lib.validateRecords(
          [cycle("9001", "9002"), cycle("9002", "9001")],
          ["repository"],
          baseline,
        ),
      true,
    ],
    [
      "removed index link fails",
      () => {
        const broken = new Map(docs);
        const entry = broken.get("combat");
        broken.set("combat", {
          ...entry,
          text: entry.text.replaceAll("by-scope/combat.md", "x.md"),
        });
        return lib.validateGoverningDocs(repoRoot, records, broken, EXEMPT);
      },
      true,
    ],
    [
      "stale reference to a superseded ADR fails",
      () => {
        const broken = new Map(docs);
        const entry = broken.get("content");
        broken.set("content", {
          ...entry,
          text: `${entry.text}\nSee ADR-${superseded.number}.\n`,
        });
        return lib.validateGoverningDocs(repoRoot, records, broken, EXEMPT);
      },
      true,
    ],
    [
      "conflicting Rule: tokens without Consistent with: or Supersedes:",
      () => {
        const nameA = "ADR-9990-combat-overlap-a.md";
        const nameB = "ADR-9991-combat-overlap-b.md";
        const make = (name, number, rule, supersedes) => ({
          file: name,
          location: "active",
          number,
          title: `fixture ${number}`,
          status: "accepted",
          appliesTo: ["combat"],
          rule,
          supersedes,
          supersededBy: [],
          amends: [],
          amendedBy: [],
          consistentWith: [],
        });
        const a = make(
          nameA,
          "9990",
          "The combat pipeline resolves combat surface actions and torpedo combat resolution",
          [],
        );
        const b = make(
          nameB,
          "9991",
          "The combat pipeline generates combat battle offers for combat resolution and torpedo deflection",
          [],
        );
        return lib.findRuleConflicts?.([a, b], ["combat"]) ?? [];
      },
      true,
    ],
  ];
  let failed = 0;
  console.log("verify-adr-scopes: self-test");
  for (const [caseLabel, run, expectProblems] of cases) {
    const label = String(caseLabel);
    const got = run().length > 0;
    const ok = got === expectProblems;
    if (!ok) failed += 1;
    console.log(`  ${ok ? "ok  " : "FAIL"} fixture "${label}"`);
  }
  return failed === 0;
}

if (isEntryPoint(import.meta.url)) {
  if (process.argv.includes("--self-test")) {
    process.exit(runSelfTest() ? 0 : 1);
  }
  const problems = lib.verify(root, EXEMPT);
  if (problems.length > 0) {
    console.error("verify-adr-scopes: FAIL");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("verify-adr-scopes: ok");
}
