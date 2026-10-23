import { describe, expect, it } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import { summarizeTreasury } from "./treasury-summary.js";

const projection: PlayerProjection = {
  prestige: { current: 20, sackingThreshold: 16, dismissalRisk: false },
  campaignIdentity: "campaign_1",
  revision: 3 as PlayerProjection["revision"],
  month: { year: 1880, month: 3 },
  playerNationId: "uk",
  nationName: "United Kingdom",
  projectedSurplusDeficit: 3400,
  economy: {
    treasury: 50000,
    monthlyAppropriation: 4000,
    shipyardCapacity: 50,
    constructionSpend: 500,
    researchSpend: 300,
    maintenanceCost: 200,
    obligations: 100,
    researchRequested: 300,
    researchCap: 480,
    plannedConstruction: 500,
    projectedNet: 3400,
    shortfall: 0,
    status: "healthy",
    monthEndTreasury: 53400,
  },
  knownTechnologyIds: ["tech_steel_hull"],
  fleet: [
    {
      name: "Channel Fleet",
      divisions: [{ name: "Channel Squadron", areaId: "area_northern_europe", ships: [] }],
    },
  ],
  strategicAreas: [{ id: "area_northern_europe", name: "Northern Europe" }],
  ports: [
    {
      id: "port_portsmouth",
      name: "Portsmouth",
      areaId: "area_northern_europe",
      capacity: 30,
    },
  ],
  knownEnemyNations: ["nation_germany"],
  commandWorkspace: { commands: [], movementCommands: [] },
  snapshotHash: "hash_abc123",
};

describe("treasury-summary", () => {
  it("summarizes every row from the projection (income, committed expenditure, result)", () => {
    const t = summarizeTreasury(projection);
    expect(t.income).toBe(4000);
    expect(t.obligations).toBe(100);
    expect(t.fleetMaintenance).toBe(200);
    expect(t.researchSpend).toBe(300);
    expect(t.totalExpenditure).toBe(600);
    expect(t.plannedConstruction).toBe(500);
    expect(t.projectedSurplusDeficit).toBe(3400);
    expect(t.availableFunds).toBe(50000);
    expect(t.projectedMonthEndFunds).toBe(53400);
    expect(t.status).toBe("healthy");
    expect(t.shortfall).toBe(0);
    expect(t.runwayMonths).toBeUndefined();
  });

  it("carries a negative net, the shortfall, the runway and the research reason honestly", () => {
    const deficit: PlayerProjection = {
      ...projection,
      projectedSurplusDeficit: -250,
      economy: {
        ...projection.economy,
        maintenanceCost: 3_950,
        projectedNet: -250,
        shortfall: 40,
        status: "critical",
        monthEndTreasury: 49_750,
        runwayMonths: 200,
        researchSpend: 0,
        researchUnfundedReason: "NO_ELIGIBLE_RESEARCH_FIELD",
      },
    };
    const t = summarizeTreasury(deficit);
    expect(t.projectedSurplusDeficit).toBe(-250);
    expect(t.projectedMonthEndFunds).toBe(49750);
    expect(t.shortfall).toBe(40);
    expect(t.runwayMonths).toBe(200);
    expect(t.status).toBe("critical");
    expect(t.researchUnfundedReason).toBe("NO_ELIGIBLE_RESEARCH_FIELD");
    expect(t.researchRequested).toBe(300);
  });
});
