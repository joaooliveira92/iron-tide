import { describe, expect, it } from "vite-plus/test";
import { decodeBaseGrowthRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [
    {
      title: "Rule the Waves 3 manual",
      author: "Naval War Simulations / Matrix Games",
      year: 2023,
      page: "12-13",
      section: "Economy",
    },
  ],
  note: "PROVISIONAL test fixture",
};

const section = (annualGrowthBp: number) => ({
  sectionVersion: 1,
  nations: { GBR: { annualGrowthBp, provenance } },
});

describe("base growth rules (S-3 D7)", () => {
  it("decodes a per-nation rate inside the 300-500 bp band", () => {
    for (const bp of [300, 400, 500]) {
      const decoded = decodeBaseGrowthRules(section(bp));
      expect(decoded.ok && decoded.value.nations["GBR"]?.annualGrowthBp).toBe(bp);
    }
  });

  it("rejects a rate outside the band or not an integer, naming the field", () => {
    for (const bp of [0, 299, 501, 400.5]) {
      const decoded = decodeBaseGrowthRules(section(bp));
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) expect(decoded.field).toBe("nations.GBR.annualGrowthBp");
    }
  });

  it("requires provenance on every nation and rejects excess properties", () => {
    expect(
      decodeBaseGrowthRules({ sectionVersion: 1, nations: { GBR: { annualGrowthBp: 400 } } }).ok,
    ).toBe(false);
    expect(decodeBaseGrowthRules({ ...section(400), extra: 1 }).ok).toBe(false);
  });
});
