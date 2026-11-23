import { describe, expect, it } from "vite-plus/test";
import {
  SUBMARINE_POLICIES,
  isSubmarinePolicy,
  submarinePolicyOf,
  type SubmarinePolicy,
} from "../src/submarinePolicy.js";
import { submarineAttackChanceBp, type SubmarineThreatRules } from "../src/submarineThreat.js";

const base: SubmarineThreatRules = {
  hullType: "submarine",
  quotaPerBoatBp: 2500,
  attackBp: 1000,
  lossPerHitBp: 120,
  blockadeReductionBp: 8000,
};
const unrestricted = { chanceMultiplierBp: 20_000, incidentBp: 2000 };
const authored = { shortfallAmplifyBp: 5000, submarineThreat: { ...base, unrestricted } };
const plain = { shortfallAmplifyBp: 5000, submarineThreat: base };

describe("submarine policy", () => {
  it("offers fleet support, prize rules and unrestricted warfare and recognises only those", () => {
    expect(SUBMARINE_POLICIES).toEqual(["FLEET_SUPPORT", "PRIZE_RULES", "UNRESTRICTED"]);
    expect(isSubmarinePolicy("UNRESTRICTED")).toBe(true);
    expect(isSubmarinePolicy("FLEET_SUPPORT")).toBe(true);
    expect(isSubmarinePolicy("BLOCKADE")).toBe(false);
    expect(isSubmarinePolicy(3)).toBe(false);
  });

  it("reads an absent policy as prize rules", () => {
    expect(submarinePolicyOf({})).toBe("PRIZE_RULES");
    expect(submarinePolicyOf({ submarinePolicy: "UNRESTRICTED" })).toBe("UNRESTRICTED");
    expect(submarinePolicyOf({ submarinePolicy: "FLEET_SUPPORT" })).toBe("FLEET_SUPPORT");
  });
});

describe("fleet support attack chance", () => {
  const fleetSupport = { chanceMultiplierBp: 4000, quotaMultiplierBp: 4000 };
  const withFleet = { shortfallAmplifyBp: 5000, submarineThreat: { ...base, fleetSupport } };
  const both = {
    shortfallAmplifyBp: 5000,
    submarineThreat: { ...base, unrestricted, fleetSupport },
  };

  it("is the identity for an unauthored block and for the other policies", () => {
    for (const shortfall of [0, 4000, 10_000]) {
      for (const blockaded of [false, true]) {
        const reference = submarineAttackChanceBp(plain, shortfall, blockaded);
        expect(submarineAttackChanceBp(plain, shortfall, blockaded, "FLEET_SUPPORT")).toBe(
          reference,
        );
        expect(submarineAttackChanceBp(withFleet, shortfall, blockaded)).toBe(reference);
        expect(submarineAttackChanceBp(withFleet, shortfall, blockaded, "PRIZE_RULES")).toBe(
          reference,
        );
        expect(submarineAttackChanceBp(withFleet, shortfall, blockaded, "UNRESTRICTED")).toBe(
          reference,
        );
      }
    }
  });

  it("scales the amplified chance by the authored multiplier in the unrestricted slot", () => {
    expect(submarineAttackChanceBp(withFleet, 0, false, "FLEET_SUPPORT")).toBe(400);
    expect(submarineAttackChanceBp(withFleet, 4000, false, "FLEET_SUPPORT")).toBe(1200);
    expect(submarineAttackChanceBp(withFleet, 0, true, "FLEET_SUPPORT")).toBe(80);
    expect(submarineAttackChanceBp(both, 0, false, "UNRESTRICTED")).toBe(2000);
    expect(submarineAttackChanceBp(both, 0, false, "FLEET_SUPPORT")).toBe(400);
  });
});

describe("unrestricted attack chance", () => {
  const chance = (
    rules: typeof authored | typeof plain,
    shortfallBp: number,
    blockaded: boolean,
    policy?: SubmarinePolicy,
  ) => submarineAttackChanceBp(rules, shortfallBp, blockaded, policy);

  it("is the identity for prize rules, an absent policy and an unauthored multiplier", () => {
    for (const shortfall of [0, 4000, 10_000]) {
      for (const blockaded of [false, true]) {
        const reference = chance(plain, shortfall, blockaded);
        expect(chance(authored, shortfall, blockaded)).toBe(reference);
        expect(chance(authored, shortfall, blockaded, "PRIZE_RULES")).toBe(reference);
        expect(chance(plain, shortfall, blockaded, "UNRESTRICTED")).toBe(reference);
      }
    }
  });

  it("scales the amplified chance by the authored multiplier", () => {
    expect(chance(authored, 0, false, "UNRESTRICTED")).toBe(2000);
    expect(chance(authored, 4000, false, "UNRESTRICTED")).toBe(6000);
  });

  it("applies before the cap so the cap and the blockade reduction still bind", () => {
    expect(chance(authored, 10_000, false, "UNRESTRICTED")).toBe(10_000);
    expect(chance(authored, 10_000, true, "UNRESTRICTED")).toBe(2000);
    expect(chance(authored, 0, true, "UNRESTRICTED")).toBe(400);
  });
});
