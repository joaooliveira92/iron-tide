import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  ECONOMY_RATE_DENOMINATOR,
  GROWTH_BAND_MAX_BP,
  MAX_APPROPRIATION_RATE_BP,
  MAX_ECONOMIC_BASE,
  RESEARCH_SHARE_CAP_BP,
  deriveEconomicBase,
  grownBase,
  monthlyBaseGrowth,
  monthlyNetBeforeConstruction,
  monthlyResearchSpend,
  monthlyRevenue,
  researchCap,
  runwayMonths,
  settleOutflow,
} from "../src/economy.js";

// Economy spec #138 slice 1: one set of pure calculators shared by the month executor and every projection.
describe("economy calculators", () => {
  it("derives the annual base as ceil(income * 120000 / startRate)", () => {
    expect(deriveEconomicBase(SafeInt(100), SafeInt(2000))).toBe(6000);
    expect(deriveEconomicBase(SafeInt(3), SafeInt(2000))).toBe(180);
    expect(deriveEconomicBase(SafeInt(7), SafeInt(3000))).toBe(280);
    expect(deriveEconomicBase(SafeInt(1), SafeInt(7000))).toBe(18); // ceil(17.14)
  });

  it("credits authored income back at the start rate for every income", () => {
    for (let income = 1; income <= 400; income += 1) {
      const base = deriveEconomicBase(SafeInt(income), SafeInt(2000));
      expect(monthlyRevenue(base, SafeInt(2000))).toBe(income);
    }
  });

  it("equals the legacy chained floors over the scanned grid", () => {
    for (let base = 0; base <= 3000; base += 37) {
      for (let rate = 500; rate <= 5000; rate += 250) {
        const legacy = Math.floor(Math.floor((base * rate) / 10000) / 12);
        expect(monthlyRevenue(SafeInt(base), SafeInt(rate))).toBe(legacy);
      }
    }
  });

  it("is monotone in base and rate", () => {
    expect(monthlyRevenue(SafeInt(6000), SafeInt(2500))).toBeGreaterThanOrEqual(
      monthlyRevenue(SafeInt(6000), SafeInt(2000)),
    );
    expect(monthlyRevenue(SafeInt(6100), SafeInt(2000))).toBeGreaterThanOrEqual(
      monthlyRevenue(SafeInt(6000), SafeInt(2000)),
    );
  });

  it("does not overflow at the validated ceiling", () => {
    const base = SafeInt(Math.floor(Number.MAX_SAFE_INTEGER / MAX_APPROPRIATION_RATE_BP));
    expect(() => monthlyRevenue(base, SafeInt(MAX_APPROPRIATION_RATE_BP))).not.toThrow();
    expect(ECONOMY_RATE_DENOMINATOR).toBe(120000);
  });

  it("caps research at 12% of monthly revenue and pays floor(annual/12)", () => {
    expect(RESEARCH_SHARE_CAP_BP).toBe(1200);
    expect(researchCap(SafeInt(100))).toBe(12);
    expect(researchCap(SafeInt(3))).toBe(0);
    expect(monthlyResearchSpend(SafeInt(65))).toBe(5);
    expect(monthlyResearchSpend(SafeInt(11))).toBe(0);
  });

  it("settles an outflow as requested, paid and shortfall with the identity on paid", () => {
    expect(settleOutflow(SafeInt(10), SafeInt(25))).toEqual({
      requested: 10,
      paid: 10,
      shortfall: 0,
    });
    expect(settleOutflow(SafeInt(10), SafeInt(4))).toEqual({
      requested: 10,
      paid: 4,
      shortfall: 6,
    });
    expect(settleOutflow(SafeInt(10), SafeInt(0))).toEqual({
      requested: 10,
      paid: 0,
      shortfall: 10,
    });
  });

  it("nets revenue against obligations, maintenance and research before construction", () => {
    const net = monthlyNetBeforeConstruction({
      revenue: SafeInt(100),
      obligations: SafeInt(38),
      maintenance: SafeInt(16),
      research: SafeInt(5),
    });
    expect(net).toBe(41);
  });

  it("gives a runway only when the net is negative", () => {
    expect(runwayMonths(SafeInt(41), SafeInt(1))).toBeUndefined();
    expect(runwayMonths(SafeInt(41), SafeInt(0))).toBeUndefined();
    expect(runwayMonths(SafeInt(41), SafeInt(-1))).toBe(41);
    expect(runwayMonths(SafeInt(10), SafeInt(-3))).toBe(3);
  });
});

describe("growth contract (G7)", () => {
  it("is floor(base x rate / 120000) inside the 300-500 bp band and rejects anything else", () => {
    expect(monthlyBaseGrowth(SafeInt(60_000), 500)).toBe(250);
    expect(monthlyBaseGrowth(SafeInt(60_000), 300)).toBe(150);
    for (const bad of [299, 501, 400.5, Number.NaN])
      expect(() => monthlyBaseGrowth(SafeInt(60_000), bad)).toThrow(RangeError);
  });

  it("never grows a base below 240, even at the maximum rate", () => {
    for (let base = 0; base < 240; base++)
      expect(monthlyBaseGrowth(SafeInt(base), GROWTH_BAND_MAX_BP)).toBe(0);
    expect(monthlyBaseGrowth(SafeInt(240), GROWTH_BAND_MAX_BP)).toBe(1);
  });

  it("is monotone in the base and the rate", () => {
    for (let base = 0; base <= 5_000; base += 97) {
      expect(
        monthlyBaseGrowth(SafeInt(base + 97), 400) >= monthlyBaseGrowth(SafeInt(base), 400),
      ).toBe(true);
      expect(monthlyBaseGrowth(SafeInt(base), 500) >= monthlyBaseGrowth(SafeInt(base), 300)).toBe(
        true,
      );
    }
  });

  it("holds the base at the overflow ceiling instead of overflowing", () => {
    const ceiling = SafeInt(MAX_ECONOMIC_BASE);
    expect(grownBase(ceiling, 500)).toBe(ceiling);
    expect(grownBase(SafeInt(MAX_ECONOMIC_BASE - 1), 500)).toBe(ceiling);
    expect(
      Number.isSafeInteger(monthlyRevenue(grownBase(ceiling, 500), SafeInt(5000)) as number),
    ).toBe(true);
  });

  it("does not compound without limit: twenty years at the top rate stays under 2.75x", () => {
    let base = SafeInt(60_000);
    for (let month = 0; month < 240; month++) base = grownBase(base, 500);
    expect(base < 60_000 * 2.75).toBe(true);
    expect(base > 60_000).toBe(true);
  });
});
