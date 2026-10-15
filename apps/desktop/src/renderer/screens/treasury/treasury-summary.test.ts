import { describe, expect, it } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import { summarizeTreasury } from "./treasury-summary.js";

const projection: PlayerProjection = {
  campaignIdentity: "campaign_1",
  revision: 3 as PlayerProjection["revision"],
  month: { year: 1880, month: 3 },
  playerNationId: "uk",
  nationName: "United Kingdom",
  projectedSurplusDeficit: 1000,
  economy: {
    treasury: 50000,
    monthlyAppropriation: 4000,
    shipyardCapacity: 50,
    constructionSpend: 500,
    researchSpend: 300,
    maintenanceCost: 200,
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
  it("summarizes every row from the projection (income, expenditure, result)", () => {
    const t = summarizeTreasury(projection);
    expect(t.income).toBe(4000);
    expect(t.fleetMaintenance).toBe(200);
    expect(t.constructionSpend).toBe(500);
    expect(t.researchSpend).toBe(300);
    expect(t.totalExpenditure).toBe(1000);
    expect(t.projectedSurplusDeficit).toBe(1000);
    expect(t.availableFunds).toBe(50000);
    expect(t.projectedMonthEndFunds).toBe(51000);
  });

  it("carries a negative projected surplus/deficit honestly", () => {
    const deficit: PlayerProjection = {
      ...projection,
      projectedSurplusDeficit: -250,
      economy: { ...projection.economy, maintenanceCost: 2500 },
    };
    const t = summarizeTreasury(deficit);
    expect(t.projectedSurplusDeficit).toBe(-250);
    expect(t.projectedMonthEndFunds).toBe(49750);
  });
});
