import { describe, expect, it } from "vite-plus/test";
import { decodeTensionDriftRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL tension drift coefficients",
};

function rules(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionVersion: 1,
    maxRiseProbabilityBp: 150,
    navalRatio: { thresholdBp: 20_000, pressureBp: 40, tensionCeiling: 6 },
    damping: { alliedBp: 60, tradeAgreementBp: 25 },
    cooling: { alliedBp: 30, tradeAgreementBp: 15 },
    provenance,
    ...overrides,
  };
}

describe("decodeTensionDriftRules", () => {
  it("accepts a complete section", () => {
    const decoded = decodeTensionDriftRules(rules());
    expect(decoded.ok).toBe(true);
  });

  it.each(["maxRiseProbabilityBp", "navalRatio", "damping", "cooling", "provenance"])(
    "requires %s with no default",
    (key) => {
      const { [key]: _removed, ...partial } = rules();
      const decoded = decodeTensionDriftRules(partial);
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) expect(decoded.field).toContain(key);
    },
  );

  it("rejects an excess key", () => {
    expect(decodeTensionDriftRules(rules({ extra: 1 })).ok).toBe(false);
    expect(
      decodeTensionDriftRules(rules({ damping: { alliedBp: 1, tradeAgreementBp: 1, extra: 1 } }))
        .ok,
    ).toBe(false);
  });

  it.each([
    ["a non-integer probability", { maxRiseProbabilityBp: 1.5 }],
    ["a probability above 10000", { maxRiseProbabilityBp: 10_001 }],
    ["a negative damping", { damping: { alliedBp: -1, tradeAgreementBp: 0 } }],
    [
      "a ratio threshold at or below parity",
      { navalRatio: { thresholdBp: 10_000, pressureBp: 1, tensionCeiling: 6 } },
    ],
    [
      "a pressure above 10000",
      { navalRatio: { thresholdBp: 20_000, pressureBp: 10_001, tensionCeiling: 6 } },
    ],
    [
      "a tension ceiling above 10",
      { navalRatio: { thresholdBp: 20_000, pressureBp: 1, tensionCeiling: 11 } },
    ],
    [
      "a navalRatio without a tension ceiling",
      { navalRatio: { thresholdBp: 20_000, pressureBp: 1 } },
    ],
    ["a wrong section version", { sectionVersion: 2 }],
  ])("rejects %s", (_label, override) => {
    expect(decodeTensionDriftRules(rules(override)).ok).toBe(false);
  });
});
