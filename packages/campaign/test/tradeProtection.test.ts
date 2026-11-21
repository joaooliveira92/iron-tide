import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  countTradeProtectionShips,
  isRaiderEligible,
  isRaiderBlockedByBlockade,
  merchantLossChanceBp,
  tradeProtectionQuota,
  tradeProtectionRevenueBp,
  tradeProtectionShortfall,
  tradeProtectionUnrestStep,
  type TradeProtectionRules,
} from "../src/tradeProtection.js";

const rules: TradeProtectionRules = {
  fleetShareBp: 2500,
  resourcesPerRequiredShip: 100,
  contributingHullTypes: ["destroyer", "corvette", "protected_cruiser", "armoured_cruiser"],
  raiderHullTypes: ["protected_cruiser", "armoured_cruiser", "armed_merchant_cruiser"],
  amcHullType: "armed_merchant_cruiser",
  amcMinSpeedUms: 4_115_552,
  raiderHitBp: 1500,
  shortfallAmplifyBp: 5000,
  lossPerHitBp: 300,
  pressureChanceBp: 3000,
  pressureLossBp: 200,
  recoveryBpPerMonth: 100,
  revenueSensitivityBp: 5000,
  unrestThresholdBp: 1000,
  unrestCadenceMonths: 3,
  unrestStep: 1,
};

const design = (hullType: string, speed = 10_000_000, shortRange = false) => ({
  hullType,
  normalizedSpeedUms: speed,
  ...(shortRange ? { shortRange: true as const } : {}),
});

describe("trade protection requirement", () => {
  it("scales with fleet size and economy in whole ships", () => {
    expect(tradeProtectionQuota(rules, 10, 0)).toBe(3);
    expect(tradeProtectionQuota(rules, 10, 450)).toBe(7);
    expect(tradeProtectionQuota(rules, 0, 0)).toBe(0);
  });

  it("counts only active ships on trade protection duty in contributing hull types", () => {
    const ships = [
      {
        id: "a",
        designVersionId: "dd",
        readiness: "ACTIVE",
        stationAssignment: "TRADE_PROTECTION",
      },
      {
        id: "b",
        designVersionId: "dd",
        readiness: "RESERVE",
        stationAssignment: "TRADE_PROTECTION",
      },
      {
        id: "c",
        designVersionId: "bb",
        readiness: "ACTIVE",
        stationAssignment: "TRADE_PROTECTION",
      },
      { id: "d", designVersionId: "dd", readiness: "ACTIVE" },
    ] as const;
    const designs = new Map([
      ["dd", design("destroyer")],
      ["bb", design("pre_dreadnought")],
    ]);
    expect(countTradeProtectionShips(rules, ships, designs)).toBe(1);
  });
});

describe("raider eligibility", () => {
  const raider = {
    designVersionId: "x",
    readiness: "ACTIVE",
    stationAssignment: "RAIDER",
  } as const;

  it("bars short range ships and non-raider hulls", () => {
    expect(isRaiderEligible(rules, raider, design("protected_cruiser"))).toBe(true);
    expect(isRaiderEligible(rules, raider, design("protected_cruiser", 10_000_000, true))).toBe(
      false,
    );
    expect(isRaiderEligible(rules, raider, design("destroyer"))).toBe(false);
  });

  it("applies the 8 knot floor to AMCs only", () => {
    expect(isRaiderEligible(rules, raider, design("armed_merchant_cruiser", 4_000_000))).toBe(
      false,
    );
    expect(isRaiderEligible(rules, raider, design("armed_merchant_cruiser", 4_115_552))).toBe(true);
    expect(isRaiderEligible(rules, raider, design("protected_cruiser", 3_000_000))).toBe(true);
  });
});

describe("blockade predicate (manual p.72)", () => {
  const blockades = [
    { blockaderId: "gb", blockadedNationId: "fr", areaId: "a", establishedMonth: "1880-01" },
  ];

  it("blocks raiders only when the raider nation blockades the victim", () => {
    expect(isRaiderBlockedByBlockade(blockades, "gb", "fr")).toBe(true);
    expect(isRaiderBlockedByBlockade(blockades, "fr", "gb")).toBe(false);
  });
});

describe("loss chance and effects", () => {
  it("amplifies the loss chance with the victim shortfall and caps at certainty", () => {
    expect(merchantLossChanceBp(rules, 0)).toBe(1500);
    expect(merchantLossChanceBp(rules, 10_000)).toBe(6500);
    expect(merchantLossChanceBp({ ...rules, raiderHitBp: 9000 }, 10_000)).toBe(10_000);
  });

  it("scales revenue by the pool loss", () => {
    expect(tradeProtectionRevenueBp(rules, 10_000)).toBe(10_000);
    expect(tradeProtectionRevenueBp(rules, 6000)).toBe(8000);
  });

  it("raises unrest on the cadence once losses cross the threshold", () => {
    expect(tradeProtectionUnrestStep(rules, 9500, "1880-03")).toEqual(Result.succeed(0));
    expect(tradeProtectionUnrestStep(rules, 8900, "1880-03")).toEqual(Result.succeed(1));
    expect(tradeProtectionUnrestStep(rules, 8900, "1880-04")).toEqual(Result.succeed(0));
  });
});

describe("checked arithmetic and month parsing (#1037)", () => {
  it.each(["", "1880", "1880-", "1880-13", "1880-00", "abcd-ef", "1880-3", "1880-03-01"])(
    "rejects the malformed month %j in the unrest cadence",
    (month) => {
      const step = tradeProtectionUnrestStep(rules, 8900, month);
      expect(Result.isFailure(step)).toBe(true);
      if (Result.isFailure(step)) expect(step.failure._tag).toBe("TradeProtectionMonthInvalid");
    },
  );

  it("raises a quota overflow instead of returning an imprecise count", () => {
    expect(() => tradeProtectionQuota(rules, Number.MAX_SAFE_INTEGER, 0)).toThrow();
  });

  it("raises a revenue overflow instead of returning an imprecise rate", () => {
    expect(() =>
      tradeProtectionRevenueBp({ ...rules, revenueSensitivityBp: Number.MAX_SAFE_INTEGER }, 0),
    ).toThrow();
  });

  it("raises a shortfall overflow instead of returning an imprecise share", () => {
    expect(() => tradeProtectionShortfall(Number.MAX_SAFE_INTEGER, 0)).toThrow();
  });

  it("keeps the authored arithmetic exact", () => {
    expect(tradeProtectionQuota(rules, 5, 250)).toBe(4);
    expect(tradeProtectionShortfall(3, 1)).toEqual({ shortfall: 2, shortfallBp: 6666 });
    expect(merchantLossChanceBp(rules, 3333)).toBe(3166);
  });
});
