import type { CampaignSnapshot, CompiledDesignVersion } from "@bluewave/campaign";
import { constructionProjectReadout } from "@bluewave/campaign-engine";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { compileDesign, historicalBuildMonths, type DesignDraft } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  buildDesignVersion,
  MonthExecutor,
  placeConstructionOrder,
  pricingFor,
} from "../src/index.js";
import { makeBattleSnapshot, makeNation } from "./battle-fixtures.js";
import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const MONTH = { year: 1880, month: 1 };
const MONTH_ID = "1880-01";

function ukDesign(referenceId: string): CompiledDesignVersion {
  const reference = readReferenceDesignEntries().find((d) => d.id === referenceId)!;
  const draft: DesignDraft = { ...reference.draft, nationId: "uk" };
  const compiled = compileDesign(draft, content.environmentFor(MONTH_ID, "uk").ctx);
  if (!compiled.valid) throw new Error(`reference design ${referenceId} does not compile`);
  return {
    ...buildDesignVersion(
      compiled,
      draft,
      {
        designVersionId: "dv-home",
        designFamilyId: "fam-home",
        className: "Home",
        hullType: "pre_dreadnought",
        machineryType: "steam",
        contentVersion: "t",
        kgPerHitPoint: content.kgPerHitPoint,
      },
      pricingFor(content, MONTH_ID),
    ),
    nationId: "uk",
  };
}

function snapshotWith(design: CompiledDesignVersion): CampaignSnapshot {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  const uk = {
    ...makeNation("uk", []),
    treasury: SafeInt(10_000_000),
    income: SafeInt(10_000_000),
    baseResources: SafeInt(1_000_000_000),
  };
  return {
    ...base,
    startYear: MONTH.year,
    startMonth: MONTH.month,
    turnNumber: SafeInt(0),
    nations: new Map([["uk", uk]]),
    designs: new Map([[design.designVersionId, design]]),
  } as CampaignSnapshot;
}

function replay(start: CampaignSnapshot, maxMonths: number) {
  let current = start;
  const completedAfter: boolean[] = [];
  const workAfter: number[] = [];
  for (let m = 0; m < maxMonths; m += 1) {
    const result = new MonthExecutor().execute(
      current,
      [],
      `seed-${String(m)}`,
      new DiagnosticCollector(),
      undefined,
      { shipBuilding: content },
    );
    expect(result.success).toBe(true);
    current = {
      ...result.finalSnapshot,
      turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt(1)),
    };
    const project = current.nations.get("uk")!.constructionProjects[0]!;
    completedAfter.push(project.status === "COMPLETED");
    workAfter.push(Number(project.completedWork));
    if (project.status === "COMPLETED") break;
  }
  return { completedAfter, workAfter };
}

describe("home construction takes its historical build time (#565)", () => {
  const design = ukDesign("alexandra_1877");
  const snapshot = snapshotWith(design);
  const placed = placeConstructionOrder(
    snapshot,
    { nationId: "uk", commandId: "cmd-home", designVersionId: "dv-home", month: MONTH },
    content,
  );

  it("keeps the project paced when a national cost multiplier changes its price", () => {
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const planTotal = Object.values(design.constructionPlan!.packages).reduce(
      (sum, p) => sum + Number(p.totalWork),
      0,
    );
    expect(Number(placed.project.totalWork)).not.toBe(planTotal);
    expect(placed.project.packages).toBeDefined();
    const packageTotal = placed.project.packages!.reduce((sum, p) => sum + Number(p.totalWork), 0);
    expect(packageTotal).toBe(Number(placed.project.totalWork));
  });

  it("is still in progress after one month and completes at the historical month count", () => {
    if (!placed.ok) throw new Error("order rejected");
    const profile = content.navalProfileFor("uk", MONTH_ID)!;
    expect(profile).not.toBeNull();
    const expectedMonths = placed.project.buildMonths!;
    const balance = content.environmentFor(MONTH_ID, "uk").constructionBalance;
    const historical = historicalBuildMonths(Number(design.normalizedDisplacementKg), balance, {
      month: MONTH_ID,
    });
    expect(expectedMonths).toBeGreaterThanOrEqual(Math.round(historical * 0.9));
    expect(expectedMonths).toBeGreaterThan(36);

    const { completedAfter, workAfter } = replay(placed.snapshot, expectedMonths + 12);
    const takenMonths = completedAfter.findIndex(Boolean) + 1;
    expect(completedAfter[0]).toBe(false);
    expect(workAfter[0]).toBeLessThan(Number(placed.project.totalWork));
    expect(takenMonths).toBeGreaterThanOrEqual(expectedMonths);
    expect(takenMonths).toBeLessThanOrEqual(expectedMonths + 6);
  });

  it("shows in the readout the months the replay actually takes", () => {
    if (!placed.ok) throw new Error("order rejected");
    const readout = constructionProjectReadout(placed.project, design, MONTH_ID);
    const { completedAfter } = replay(placed.snapshot, placed.project.buildMonths! + 12);
    expect(readout.remainingMonths).toBe(completedAfter.findIndex(Boolean) + 1);
  });

  it("rejects an order whose design carries no construction plan", () => {
    const unplanned: CompiledDesignVersion = { ...design };
    delete unplanned.constructionPlan;
    const result = placeConstructionOrder(
      snapshotWith(unplanned),
      { nationId: "uk", commandId: "cmd-bare", designVersionId: "dv-home", month: MONTH },
      content,
    );
    expect(result).toMatchObject({ ok: false, reason: "CONSTRUCTION_PLAN_MISSING" });
  });
});
