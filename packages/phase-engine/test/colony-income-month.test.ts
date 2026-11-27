import { economyOutlook, type CampaignSnapshot, type PossessionData } from "@bluewave/campaign";
import { reconcileMonthLedger } from "@bluewave/campaign-engine";
import { colonyIncomeForNation } from "@bluewave/campaign";
import { decodeColonyIncomeRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { COLONY_INCOME_CATEGORY } from "../src/colonyIncomeMonth.js";
import { MonthExecutor, type MonthExecutorEngineOptions } from "../src/index.js";
import { tradeSnapshot } from "./fixtures/trade-protection.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "13" }],
  note: "PROVISIONAL test fixture",
};

function fixtureRules(): NonNullable<MonthExecutorEngineOptions["colonyIncome"]> {
  const decoded = decodeColonyIncomeRules({
    sectionVersion: 1,
    baselineYear: 1880,
    startFactorBp: 10_000,
    slopeBpPerYear: 120,
    floorBp: 2_500,
    provenance,
  });
  if (!decoded.ok) throw new Error("fixture colonyIncome must decode");
  return decoded.value;
}

const owned = (id: string, nationId: string, valueBp?: number): PossessionData => ({
  id,
  nationId,
  areaId: `area_${id}`,
  ...(valueBp === undefined ? {} : { colonyValueBp: SafeInt(valueBp) }),
});

function start(month: number, possessions: PossessionData[], base = 120_000): CampaignSnapshot {
  const snapshot = tradeSnapshot({
    gbrShips: [],
    atWar: false,
    month,
    gbr: { baseResources: base as never },
    fra: { baseResources: 120_000 as never },
  });
  return { ...snapshot, world: { ...snapshot.world, possessions } };
}

function run(from: CampaignSnapshot, options: MonthExecutorEngineOptions) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(from, [], "colony-seed", collector, undefined, {
    playerNationId: "GBR",
    ...options,
  });
  return Object.assign(result, { collector });
}

const digest = (value: unknown) => sha256Hex(canonicalSerialize(value));

const colonyEntries = (r: ReturnType<typeof run>, nationId: string) =>
  r.financialLedger.all.filter((e) => e.nationId === nationId && e.categoryId === "COLONY_INCOME");

describe("monthly colony income (manual p.13, S-3 D7)", () => {
  const possessions = [owned("p1", "GBR", 100), owned("p2", "GBR", 50), owned("p3", "FRA")];

  it("credits a separate COLONY_INCOME entry equal to the decayed value of the owned possessions", () => {
    const result = run(start(0, possessions), { colonyIncome: fixtureRules() });
    const entries = colonyEntries(result, "GBR");
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    const expected = colonyIncomeForNation(
      fixtureRules(),
      possessions,
      "GBR",
      SafeInt(120_000),
      entry.campaignMonth,
    );
    expect(expected?.amount).toBeGreaterThan(0);
    expect(entry.credit).toBe(expected?.amount);
    expect(entry.debit).toBe(entry.credit);
    expect((entry.newBalance as number) - (entry.previousBalance as number)).toBe(entry.credit);
    expect(colonyEntries(result, "FRA")).toHaveLength(0);
  });

  it("falls over the campaign: the same possessions pay less thirty years later", () => {
    const early = colonyEntries(
      run(start(0, possessions), { colonyIncome: fixtureRules() }),
      "GBR",
    );
    const late = colonyEntries(
      run(start(360, possessions), { colonyIncome: fixtureRules() }),
      "GBR",
    );
    expect(late[0]!.credit).toBeLessThan(early[0]!.credit);
    expect(late[0]!.credit).toBeGreaterThan(0);
  });

  it("keeps the ledger identity: the balance chain runs from opening to closing through the colony entry", () => {
    const from = start(0, possessions);
    const result = run(from, { colonyIncome: fixtureRules() });
    const gbr = result.financialLedger.all.filter((e) => e.nationId === "GBR");
    expect(gbr.some((e) => e.categoryId === "COLONY_INCOME")).toBe(true);
    expect(gbr[0]!.previousBalance).toBe(from.nations.get("GBR")!.treasury);
    gbr.slice(1).forEach((entry, index) => {
      expect(entry.previousBalance).toBe(gbr[index]!.newBalance);
    });
    expect(gbr.at(-1)!.newBalance).toBe(result.finalSnapshot.nations.get("GBR")!.treasury);
  });

  it("adds nothing and moves no hash when the section is absent", () => {
    const from = start(0, possessions);
    const dormant = run(from, {});
    const baseline = new MonthExecutor().execute(
      from,
      [],
      "colony-seed",
      new DiagnosticCollector(),
    );
    expect(colonyEntries(dormant, "GBR")).toHaveLength(0);
    expect(digest(dormant.finalSnapshot)).toBe(digest(baseline.finalSnapshot));
    expect(digest(dormant.eventLedger.all)).toBe(digest(baseline.eventLedger.all));
    expect(digest(dormant.financialLedger.all)).toBe(digest(baseline.financialLedger.all));
  });

  it("adds nothing and moves no hash when no possession carries a value", () => {
    const unvalued = [owned("p1", "GBR"), owned("p2", "FRA")];
    const from = start(0, unvalued);
    const withRules = run(from, { colonyIncome: fixtureRules() });
    const without = run(from, {});
    expect(colonyEntries(withRules, "GBR")).toHaveLength(0);
    expect(digest(withRules.finalSnapshot)).toBe(digest(without.finalSnapshot));
    expect(digest(withRules.eventLedger.all)).toBe(digest(without.eventLedger.all));
    expect(digest(withRules.financialLedger.all)).toBe(digest(without.financialLedger.all));
  });

  it("projects the same month-end treasury the pipeline produces", () => {
    const from = start(0, possessions);
    const rules = fixtureRules();
    const outlook = economyOutlook(from, "GBR", { colonyIncome: rules })!;
    const result = run(from, { colonyIncome: rules });
    expect(outlook.colonyIncome).toBe(colonyEntries(result, "GBR")[0]!.credit);
    expect(outlook.monthEndTreasury).toBe(
      result.finalSnapshot.nations.get("GBR")!.treasury as number,
    );
  });

  it("is booked under the category the campaign-engine reconciliation reads", () => {
    const result = run(start(0, possessions), { colonyIncome: fixtureRules() });
    const entries = result.financialLedger.all.filter((e) => e.nationId === "GBR");
    expect(entries.some((e) => e.categoryId === COLONY_INCOME_CATEGORY)).toBe(true);
    const reconciliation = reconcileMonthLedger(
      entries,
      entries[0]!.previousBalance as number,
      entries.at(-1)!.newBalance as number,
    );
    expect(reconciliation.colonyIncome).toBe(colonyEntries(result, "GBR")[0]!.credit);
  });

  it("is independent of the appropriation rate: a zero rate still pays colony income", () => {
    const from = start(0, possessions);
    const gbr = from.nations.get("GBR")!;
    const zeroRate = {
      ...from,
      nations: new Map(from.nations).set("GBR", {
        ...gbr,
        navalAppropriationRateBp: SafeInt(0),
      }),
    };
    const result = run(zeroRate, { colonyIncome: fixtureRules() });
    expect(colonyEntries(result, "GBR")).toHaveLength(1);
    expect(result.finalSnapshot.nations.get("GBR")!.treasury).toBeGreaterThan(gbr.treasury);
  });
});
