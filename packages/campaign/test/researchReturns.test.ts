import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { RESEARCH_SHARE_CAP_BP, effectiveResearchResources } from "../src/index.js";

const rules = { fullReturnShareBp: 1000, aboveMarginalBp: 5000 };
const revenue = SafeInt(1000);
const effective = (paid: number, r = rules) =>
  effectiveResearchResources(SafeInt(paid), revenue, r) as number;

describe("effectiveResearchResources (manual p.16, S-3 D7)", () => {
  it("counts spend up to the threshold one for one", () => {
    expect(effective(0)).toBe(0);
    expect(effective(60)).toBe(60);
    expect(effective(100)).toBe(100);
  });

  it("counts only the marginal share of spend above the threshold", () => {
    expect(effective(101)).toBe(100);
    expect(effective(102)).toBe(101);
    expect(effective(120)).toBe(110);
  });

  it("is monotonic and continuous at the threshold across the whole funded range", () => {
    const cap = ((revenue as number) * RESEARCH_SHARE_CAP_BP) / 10_000;
    let previous = 0;
    for (let paid = 1; paid <= cap; paid += 1) {
      const value = effective(paid);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value - previous).toBeLessThanOrEqual(1);
      previous = value;
    }
  });

  it("is linear when the marginal rate is full, which restores the pre-curve behaviour", () => {
    for (const paid of [0, 50, 100, 101, 120])
      expect(effective(paid, { ...rules, aboveMarginalBp: 10_000 })).toBe(paid);
  });

  it("is linear when no rules are authored", () => {
    expect(effectiveResearchResources(SafeInt(120), revenue, undefined)).toBe(120);
  });

  it("never pays out for a non-positive spend", () => {
    expect(effectiveResearchResources(SafeInt(0), revenue, rules)).toBe(0);
    expect(effectiveResearchResources(SafeInt(-5), revenue, rules)).toBe(0);
  });
});
