import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Compiler,
  buildFullSurfaceInput,
  tensionDriftFromRulesets,
} from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { planTensionDrift } from "../src/tensionDrift.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const contentDir = resolve(here, "..", "..", "..", "content", "production", "1880");

const collector = new DiagnosticCollector();
const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
const output = new Compiler().compile(input!, new AbortController().signal, collector);
const bundle = output!.bundle;
const decodedRules = tensionDriftFromRulesets(bundle.rulesets);
if (decodedRules === undefined || !decodedRules.ok) {
  throw new Error("the production pack must carry a valid tensionDrift section");
}
const rules = decodedRules.value;

interface DiplomacyRow {
  readonly nationA: string;
  readonly nationB: string;
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement";
  readonly tension?: number;
  readonly frictionBp?: number;
}
interface EconomyRow {
  readonly nationId: string;
  readonly income: number;
}

const diplomacy = (bundle.campaign?.diplomacy ?? []) as readonly DiplomacyRow[];
const incomeOf = new Map(
  ((bundle.campaign?.economies ?? []) as readonly EconomyRow[]).map((row) => [
    row.nationId,
    row.income,
  ]),
);

const nationIds = (bundle.nations as readonly { readonly id: string }[])
  .map((nation) => nation.id)
  .sort();
const authoredKey = (a: string, b: string): string => [a, b].sort().join("|");
const authored = new Map(diplomacy.map((row) => [authoredKey(row.nationA, row.nationB), row]));
const allPairs: readonly DiplomacyRow[] = nationIds.flatMap((a, index) =>
  nationIds
    .slice(index + 1)
    .map(
      (b) =>
        authored.get(authoredKey(a, b)) ?? { nationA: a, nationB: b, relation: "neutral" as const },
    ),
);

const MONTHS = 240;
const expectedSteps = (row: DiplomacyRow): number => {
  const plan = planTensionDrift(
    {
      relation: row.relation,
      tension: row.tension ?? 5,
      frictionBp: row.frictionBp ?? 0,
      navalBudgetA: incomeOf.get(row.nationA) ?? 0,
      navalBudgetB: incomeOf.get(row.nationB) ?? 0,
    },
    rules,
  );
  return (plan.riseProbabilityBp * MONTHS) / 10_000;
};

describe("1880 production tension drift", () => {
  it("compiles cleanly with a tensionDrift section", () => {
    expect(collector.errors).toEqual([]);
    expect(rules.sectionVersion).toBe(1);
  });

  it("authors friction only on non-allied pairs and within the rise cap", () => {
    for (const row of diplomacy) {
      if (row.relation === "allied") expect(row.frictionBp).toBeUndefined();
      expect(row.frictionBp ?? 0).toBeLessThanOrEqual(rules.maxRiseProbabilityBp);
    }
  });

  it("covers every nation pair, authored or defaulted", () => {
    expect(allPairs.length).toBe((nationIds.length * (nationIds.length - 1)) / 2);
    expect(allPairs.length).toBeGreaterThan(diplomacy.length);
  });

  it("keeps every pair rare: at most three expected rises in twenty peacetime years", () => {
    for (const row of allPairs) {
      expect(
        expectedSteps(row),
        `${row.nationA}/${row.nationB} expected rises over ${String(MONTHS)} months`,
      ).toBeLessThanOrEqual(3);
    }
  });

  it("is not dormant: the most hostile pairs expect at least one rise in twenty years", () => {
    const hostile = diplomacy.filter((row) => (row.frictionBp ?? 0) >= 60);
    expect(hostile.length).toBeGreaterThan(0);
    for (const row of hostile) expect(expectedSteps(row)).toBeGreaterThanOrEqual(1);
  });

  it("keeps the whole world's drift modest: under forty expected rises in twenty years", () => {
    const total = allPairs.reduce((sum, row) => sum + expectedSteps(row), 0);
    expect(total).toBeLessThan(40);
  });

  it("keeps the impoundment threshold earned: naval pressure stops below tension 6", () => {
    expect(rules.navalRatio.tensionCeiling).toBeLessThan(6);
  });

  it("lets an alliance hold a pair down: allied pairs never rise", () => {
    const allied = diplomacy.filter((row) => row.relation === "allied");
    expect(allied.length).toBeGreaterThan(0);
    for (const row of allied) expect(expectedSteps(row)).toBe(0);
  });
});
