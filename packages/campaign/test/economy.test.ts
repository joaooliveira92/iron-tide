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

describe("economy calculators", () => {
  it("derives the annual base as ceil(income * 120000 / startRate)", () => {
    expect(deriveEconomicBase(SafeInt(100), SafeInt(2000))).toBe(6000);
    expect(deriveEconomicBase(SafeInt(3), SafeInt(2000))).toBe(180);
    expect(deriveEconomicBase(SafeInt(7), SafeInt(3000))).toBe(280);
    expect(deriveEconomicBase(SafeInt(1), SafeInt(7000))).toBe(18);
  });

  it("credits authored income back at the start rate for every income", () => {
    for (let income = 1; income <= 400; income += 1) {
      const base = deriveEconomicBase(SafeInt(income), SafeInt(2000));
      expect(monthlyRevenue(base, SafeInt(2000))).toBe(income);
    }
  });

  it("equals the legacy chained floors for every base 0..20000 and every rate 500..5000", () => {
    const counterexamples: string[] = [];
    let pairs = 0;
    for (let base = 0; base <= 20_000; base += 1) {
      const safeBase = SafeInt(base);
      for (let rate = 500; rate <= 5000; rate += 1) {
        const legacy = Math.floor(Math.floor((base * rate) / 10_000) / 12);
        const actual = monthlyRevenue(safeBase, SafeInt(rate));
        pairs += 1;
        if (actual !== legacy && counterexamples.length < 5)
          counterexamples.push(`base=${base} rate=${rate} legacy=${legacy} actual=${actual}`);
      }
    }
    expect(pairs).toBe(20_001 * 4_501);
    expect(counterexamples).toEqual([]);
  }, 60_000);

  it("holds the legacy identity at the corners of the required domain", () => {
    for (const [base, rate, expected] of [
      [0, 500, 0],
      [0, 5000, 0],
      [20_000, 500, 83],
      [20_000, 5000, 833],
    ] as const)
      expect(monthlyRevenue(SafeInt(base), SafeInt(rate))).toBe(expected);
  });

  it("is monotone in base and rate", () => {
    expect(monthlyRevenue(SafeInt(6000), SafeInt(2500))).toBeGreaterThanOrEqual(
      monthlyRevenue(SafeInt(6000), SafeInt(2000)),
    );
    expect(monthlyRevenue(SafeInt(6100), SafeInt(2000))).toBeGreaterThanOrEqual(
      monthlyRevenue(SafeInt(6000), SafeInt(2000)),
    );
  });

  it("is exact at, one below and one above the supported ceiling", () => {
    expect(ECONOMY_RATE_DENOMINATOR).toBe(120000);
    expect(MAX_ECONOMIC_BASE).toBe(Math.floor(Number.MAX_SAFE_INTEGER / MAX_APPROPRIATION_RATE_BP));
    const rate = SafeInt(MAX_APPROPRIATION_RATE_BP);
    for (const base of [MAX_ECONOMIC_BASE - 1, MAX_ECONOMIC_BASE]) {
      const exact = (BigInt(base) * BigInt(MAX_APPROPRIATION_RATE_BP)) / 120_000n;
      expect(BigInt(monthlyRevenue(SafeInt(base), rate))).toBe(exact);
    }
    expect(() => monthlyRevenue(SafeInt(MAX_ECONOMIC_BASE + 1), rate)).toThrow();
    expect((MAX_ECONOMIC_BASE + 1) * MAX_APPROPRIATION_RATE_BP > Number.MAX_SAFE_INTEGER).toBe(
      true,
    );
    expect(MAX_ECONOMIC_BASE * MAX_APPROPRIATION_RATE_BP <= Number.MAX_SAFE_INTEGER).toBe(true);
  });

  it("rejects non-integer and unsafe operands at construction, so no float reaches a calculator", () => {
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])
      expect(() => SafeInt(bad)).toThrow();
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

  it("settles every small (requested, available) pair with paid <= funds and shortfall counted exactly once", () => {
    for (let requested = 0; requested <= 60; requested += 1) {
      for (let available = -10; available <= 60; available += 1) {
        const s = settleOutflow(SafeInt(requested), SafeInt(available));
        const label = `requested=${requested} available=${available}`;
        const spendable = Math.max(0, available);
        expect(s.requested, label).toBe(requested);
        expect(s.paid, label).toBe(Math.min(requested, spendable));
        expect(s.paid + s.shortfall, label).toBe(requested);
        expect(s.paid >= 0 && s.shortfall >= 0, label).toBe(true);
        expect(s.paid <= spendable, label).toBe(true);
        expect(s.shortfall > 0, label).toBe(requested > spendable);
        expect(settleOutflow(SafeInt(requested), SafeInt(available)), label).toEqual(s);
      }
    }
  });

  it("settles at the maximum supported magnitude without precision loss", () => {
    const max = SafeInt(Number.MAX_SAFE_INTEGER);
    expect(settleOutflow(max, max)).toEqual({ requested: max, paid: max, shortfall: 0 });
    expect(settleOutflow(max, SafeInt(0))).toEqual({ requested: max, paid: 0, shortfall: max });
    expect(settleOutflow(SafeInt(0), SafeInt(0))).toEqual({ requested: 0, paid: 0, shortfall: 0 });
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
