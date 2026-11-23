import { describe, expect, it } from "vite-plus/test";
import {
  aswEscortAttackChanceBp,
  qShipAttackChanceBp,
  submarineAttackChanceBp,
  type SubmarineThreatRules,
} from "../src/submarineThreat.js";
import { submarineEscortCounts, submarineTradeChanceStages } from "../src/submarineTradeChance.js";

const threat: SubmarineThreatRules = {
  hullType: "submarine",
  quotaPerBoatBp: 2500,
  attackBp: 1000,
  lossPerHitBp: 120,
  blockadeReductionBp: 8000,
  aswEscortReductionBp: 2000,
  qShipReductionBp: 5000,
  unrestricted: { chanceMultiplierBp: 20_000, incidentBp: 300 },
  fleetSupport: { chanceMultiplierBp: 5000 },
};

const rules = { shortfallAmplifyBp: 5000, submarineThreat: threat };

const stages = (
  shortfallBp: number,
  blockaded: boolean,
  policy: "PRIZE_RULES" | "UNRESTRICTED" | "FLEET_SUPPORT",
  counts = { aswEscorts: 0, qShips: 0 },
) => submarineTradeChanceStages(rules, shortfallBp, blockaded, policy, counts);

describe("submarine trade chance stages", () => {
  it("records each stage from the base chance to the final chance", () => {
    expect(stages(4000, true, "UNRESTRICTED", { aswEscorts: 2, qShips: 1 })).toEqual({
      attackBp: 1000,
      shortfallTermBp: 2000,
      baseBp: 3000,
      policyMultiplierBp: 20_000,
      amplifiedBp: 6000,
      cappedBp: 6000,
      blockadedBp: 1200,
      aswEscortedBp: 768,
      finalBp: 384,
    });
  });

  it("caps the amplified chance at the draw range", () => {
    const result = submarineTradeChanceStages(
      {
        shortfallAmplifyBp: 5000,
        submarineThreat: { ...threat, unrestricted: { chanceMultiplierBp: 80_000, incidentBp: 1 } },
      },
      4000,
      false,
      "UNRESTRICTED",
      { aswEscorts: 0, qShips: 0 },
    );
    expect(result.amplifiedBp).toBe(24_000);
    expect(result.cappedBp).toBe(10_000);
    expect(result.finalBp).toBe(10_000);
  });

  it("leaves the policy multiplier unset for prize rules", () => {
    const result = stages(0, false, "PRIZE_RULES");
    expect(result.policyMultiplierBp).toBeUndefined();
    expect(result.finalBp).toBe(1000);
  });

  it("matches the composed chance functions the monthly draw uses", () => {
    for (const policy of ["PRIZE_RULES", "UNRESTRICTED", "FLEET_SUPPORT"] as const) {
      for (const blockaded of [false, true]) {
        const counts = { aswEscorts: 3, qShips: 2 };
        const composed = qShipAttackChanceBp(
          threat,
          aswEscortAttackChanceBp(
            threat,
            submarineAttackChanceBp(
              { shortfallAmplifyBp: 5000, submarineThreat: threat },
              2500,
              blockaded,
              policy,
            ),
            counts.aswEscorts,
          ),
          counts.qShips,
        );
        expect(stages(2500, blockaded, policy, counts).finalBp).toBe(composed);
      }
    }
  });
});

describe("submarine escort counts", () => {
  const designs = new Map([
    ["dd", { hullType: "destroyer", normalizedSpeedUms: 1, aswLevel: 1 }],
    ["dd-blind", { hullType: "destroyer", normalizedSpeedUms: 1 }],
    ["amc", { hullType: "amc", normalizedSpeedUms: 1, aswLevel: 1 }],
  ]);
  const ship = (id: string, designVersionId: string) => ({
    id,
    designVersionId,
    readiness: "ACTIVE",
    isUnderConstruction: false,
    stationAssignment: "TRADE_PROTECTION",
  });
  const fleet = [ship("a", "dd"), ship("b", "dd-blind"), ship("c", "amc")];
  const base = { contributingHullTypes: ["destroyer", "amc"], amcHullType: "amc" };

  it("excludes Q-ships from ASW escorts only when Q-ships are authored", () => {
    expect(submarineEscortCounts({ ...base, submarineThreat: threat }, fleet, designs)).toEqual({
      aswEscorts: 1,
      qShips: 1,
    });
    const withoutQ = { ...threat, qShipReductionBp: undefined };
    expect(submarineEscortCounts({ ...base, submarineThreat: withoutQ }, fleet, designs)).toEqual({
      aswEscorts: 2,
      qShips: 1,
    });
  });
});
