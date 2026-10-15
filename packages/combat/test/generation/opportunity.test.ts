import { describe, it, expect } from "vite-plus/test";
import {
  defaultTwoNationFixture,
  buildGenerationSnapshot,
  buildShip,
} from "../fixtures/generation-fixture.js";
import { determineMissionOpportunities } from "../../src/generation/opportunity.js";
import { MAX_BATTLES_PER_AREA_PER_MONTH } from "../../src/generation/opportunity.js";
import { BATTLE_MONTHLY_LIMIT_REACHED } from "../../src/generation/reasonCodes.js";
import { assertOpportunityEligible } from "../../src/generation/opportunity.js";

describe("opportunity determination (AC-5)", () => {
  it("two co-located active-war sides produce opportunities ordered by war/area/priority/id", () => {
    const snapshot = defaultTwoNationFixture();
    const opps = determineMissionOpportunities({
      snapshot,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(),
    });
    expect(opps.length).toBeGreaterThan(0);
    // FLEET_BATTLE has lower priority number than CRUISER_BATTLE (8 < 9) -> first
    const missions = opps.map((o) => o.missionType);
    expect(missions[0]).toBe("FLEET_BATTLE");
    // Monthly limit 1/area rejects the second; the first is a CANDIDATE.
    const first = opps[0]!;
    expect(first.warId).toBe("war_1");
    expect(first.areaId).toBe("area_battle");
    expect(first.status).toBe("CANDIDATE");
    expect(first.opportunityHash).toBeTruthy();
    expect(first.eligibilityPredicateId).toBe("opportunity_reachability_v1");
    for (const o of opps) {
      expect(o.warId).toBe("war_1");
      expect(o.areaId).toBe("area_battle");
    }
  });

  it("co-located presence is required (ADR B-1-7)", () => {
    const snapshot = buildGenerationSnapshot(
      [
        buildShip({
          id: "gb_bb1",
          classId: "battleship",
          shipType: "BB",
          locationAreaId: "area_a",
          firepower: 30,
          hitPoints: 100,
        }),
      ],
      [
        buildShip({
          id: "fra_bb1",
          classId: "battleship",
          shipType: "BB",
          locationAreaId: "area_b",
          firepower: 26,
          hitPoints: 90,
        }),
      ],
    );
    const opps = determineMissionOpportunities({
      snapshot,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(),
    });
    expect(opps.length).toBe(0);
  });

  it("no active war produces no opportunities", () => {
    const snapshot = defaultTwoNationFixture();
    const noWar = { ...snapshot, wars: { ...snapshot.wars, wars: [] } };
    const opps = determineMissionOpportunities({
      snapshot: noWar,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(),
    });
    expect(opps).toEqual([]);
  });

  it("monthly limit 1 per area rejects extras with BATTLE_MONTHLY_LIMIT_REACHED", () => {
    expect(MAX_BATTLES_PER_AREA_PER_MONTH).toBe(1);
    const snapshot = defaultTwoNationFixture();
    const opps = determineMissionOpportunities({
      snapshot,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(),
    });
    // Both FLEET + CRUISER in one area -> limit rejects the second
    expect(opps.length).toBe(2);
    const rejected = opps.filter((o) => o.status === "REJECTED");
    expect(rejected.length).toBe(1);
    expect(() => assertOpportunityEligible(rejected[0]!)).toThrow(
      new RegExp(BATTLE_MONTHLY_LIMIT_REACHED),
    );
  });

  it("opportunities consume no seed and are deterministic", () => {
    const snapshot = defaultTwoNationFixture();
    const a = determineMissionOpportunities({
      snapshot,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(),
    });
    const b = determineMissionOpportunities({
      snapshot,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(),
    });
    expect(a.map((o) => o.opportunityHash)).toEqual(b.map((o) => o.opportunityHash));
  });

  it("already-accepted war-area pair yields no new opportunity", () => {
    const snapshot = defaultTwoNationFixture();
    const opps = determineMissionOpportunities({
      snapshot,
      campaignMonth: "1880-02",
      acceptedOpportunityIds: new Set(),
      acceptedWarAreaPairs: new Set(["war_1:area_battle"]),
    });
    expect(opps.length).toBe(0);
  });
});
