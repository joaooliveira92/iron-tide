import { describe, expect, it } from "vite-plus/test";
import { decodeResearchReturnsRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [
    {
      title: "Rule the Waves 3 manual",
      author: "Naval War Simulations / Matrix Games",
      year: 2023,
      page: "16",
      section: "Research",
    },
  ],
  note: "PROVISIONAL test fixture",
};

const section = (fullReturnShareBp: number, aboveMarginalBp: number) => ({
  sectionVersion: 1,
  fullReturnShareBp,
  aboveMarginalBp,
  provenance,
});

describe("research returns rules (manual p.16, S-3 D7)", () => {
  it("decodes a threshold below the 12 percent cap and a marginal rate in 0-10000", () => {
    const decoded = decodeResearchReturnsRules(section(1000, 5000));
    expect(decoded.ok && decoded.value.aboveMarginalBp).toBe(5000);
    expect(decodeResearchReturnsRules(section(1000, 0)).ok).toBe(true);
    expect(decodeResearchReturnsRules(section(1000, 10_000)).ok).toBe(true);
  });

  it("rejects a marginal rate outside 0-10000 and a non-integer", () => {
    expect(decodeResearchReturnsRules(section(1000, -1)).ok).toBe(false);
    expect(decodeResearchReturnsRules(section(1000, 10_001)).ok).toBe(false);
    expect(decodeResearchReturnsRules(section(1000, 0.5)).ok).toBe(false);
  });

  it("rejects a threshold that is not a positive share below the cap", () => {
    expect(decodeResearchReturnsRules(section(0, 5000)).ok).toBe(false);
    expect(decodeResearchReturnsRules(section(1200, 5000)).ok).toBe(true);
    expect(decodeResearchReturnsRules(section(1201, 5000)).ok).toBe(false);
  });

  it("requires provenance and rejects excess properties", () => {
    const { provenance: _omitted, ...bare } = section(1000, 5000);
    expect(decodeResearchReturnsRules(bare).ok).toBe(false);
    expect(decodeResearchReturnsRules({ ...section(1000, 5000), extra: 1 }).ok).toBe(false);
  });
});
