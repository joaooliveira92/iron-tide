import { economyOutlook, type CampaignSnapshot, type PossessionData } from "@bluewave/campaign";
import { decodeBaseGrowthRules, decodeColonyIncomeRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthExecutorEngineOptions } from "../src/index.js";
import { TRADE_RULES, tradeSnapshot } from "./fixtures/trade-protection.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "13" }],
  note: "PROVISIONAL test fixture",
};

function growthRules(): NonNullable<MonthExecutorEngineOptions["baseGrowth"]> {
  const decoded = decodeBaseGrowthRules({
    sectionVersion: 1,
    nations: { GBR: { annualGrowthBp: 400, provenance } },
  });
  if (!decoded.ok) throw new Error("fixture baseGrowth must decode");
  return decoded.value;
}

function colonyRules(): NonNullable<MonthExecutorEngineOptions["colonyIncome"]> {
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

const possessions: PossessionData[] = [
  { id: "p1", nationId: "GBR", areaId: "area_p1", colonyValueBp: SafeInt(100) },
  { id: "p2", nationId: "GBR", areaId: "area_p2", colonyValueBp: SafeInt(50) },
];

function start(poolBp: number | undefined): CampaignSnapshot {
  const snapshot = tradeSnapshot({
    gbrShips: [],
    atWar: false,
    month: 1,
    gbr: { baseResources: 60_000 as never },
    fra: { baseResources: 60_000 as never },
  });
  const gbr = snapshot.nations.get("GBR")!;
  const nations = new Map(snapshot.nations);
  nations.set("GBR", {
    ...gbr,
    tradeProtection:
      poolBp === undefined
        ? gbr.tradeProtection
        : { ...gbr.tradeProtection!, merchantPoolBp: poolBp },
  });
  return { ...snapshot, nations, world: { ...snapshot.world, possessions } };
}

function pipelineTreasury(from: CampaignSnapshot, options: MonthExecutorEngineOptions): number {
  const result = new MonthExecutor().execute(
    from,
    [],
    "outlook-seed",
    new DiagnosticCollector(),
    undefined,
    { playerNationId: "GBR", ...options },
  );
  return result.finalSnapshot.nations.get("GBR")!.treasury as number;
}

describe("economy outlook reproduces the monthly revenue phase", () => {
  it("projects the grown base, trade-scaled revenue and colony income the pipeline books", () => {
    const from = start(6_000);
    const engine = {
      baseGrowth: growthRules(),
      tradeProtection: TRADE_RULES,
      colonyIncome: colonyRules(),
    };
    const outlook = economyOutlook(from, "GBR", engine)!;
    const plain = economyOutlook(from, "GBR", { colonyIncome: engine.colonyIncome })!;
    expect(outlook.revenue).not.toBe(plain.revenue);
    expect(outlook.monthEndTreasury).toBe(pipelineTreasury(from, engine));
  });

  it("matches with base growth alone", () => {
    const from = start(undefined);
    const engine = { baseGrowth: growthRules() };
    expect(economyOutlook(from, "GBR", engine)!.monthEndTreasury).toBe(
      pipelineTreasury(from, engine),
    );
  });
});
