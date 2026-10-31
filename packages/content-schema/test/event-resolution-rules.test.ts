import { describe, expect, it } from "vite-plus/test";
import { decodeEventResolutionRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL event resolution weights",
};

const even = { hawkBp: 4_000, doveBp: 4_000, neutralBp: 2_000 };

function rules(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionVersion: 1,
    defaultAnswerAfterMonths: 3,
    aiStanceWeightsBp: {
      liberal_democracy: { hawkBp: 2_000, doveBp: 6_000, neutralBp: 2_000 },
      limited_democracy: even,
      autocratic: { hawkBp: 6_000, doveBp: 2_000, neutralBp: 2_000 },
      fascist: { hawkBp: 7_000, doveBp: 1_000, neutralBp: 2_000 },
      communist: even,
      eastern: even,
    },
    traitShifts: [{ trait: "cautious", stance: "hawk", deltaBp: -1_500 }],
    provenance,
    ...overrides,
  };
}

describe("decodeEventResolutionRules", () => {
  it("accepts a complete section", () => {
    expect(decodeEventResolutionRules(rules()).ok).toBe(true);
  });

  it.each(["defaultAnswerAfterMonths", "aiStanceWeightsBp", "traitShifts", "provenance"])(
    "requires %s with no default",
    (key) => {
      const { [key]: _removed, ...partial } = rules();
      const decoded = decodeEventResolutionRules(partial);
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) expect(decoded.field).toContain(key);
    },
  );

  it("requires a weight row for every government type", () => {
    const { eastern: _removed, ...partial } = rules()["aiStanceWeightsBp"] as Record<
      string,
      unknown
    >;
    const decoded = decodeEventResolutionRules(rules({ aiStanceWeightsBp: partial }));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.field).toContain("eastern");
  });

  it("rejects a government type that can never pick a hawk or dove answer", () => {
    const weights = {
      ...(rules()["aiStanceWeightsBp"] as Record<string, unknown>),
      communist: { hawkBp: 0, doveBp: 0, neutralBp: 10_000 },
    };
    const decoded = decodeEventResolutionRules(rules({ aiStanceWeightsBp: weights }));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.message).toContain("communist");
  });

  it("rejects a trait shifting the same stance twice", () => {
    const decoded = decodeEventResolutionRules(
      rules({
        traitShifts: [
          { trait: "cautious", stance: "hawk", deltaBp: -100 },
          { trait: "cautious", stance: "hawk", deltaBp: -200 },
        ],
      }),
    );
    expect(decoded.ok).toBe(false);
  });

  it.each([0, 25, 1.5])("rejects defaultAnswerAfterMonths %s", (value) => {
    expect(decodeEventResolutionRules(rules({ defaultAnswerAfterMonths: value })).ok).toBe(false);
  });

  it("rejects an unknown trait and an excess key", () => {
    expect(
      decodeEventResolutionRules(
        rules({ traitShifts: [{ trait: "bold", stance: "hawk", deltaBp: 10 }] }),
      ).ok,
    ).toBe(false);
    expect(decodeEventResolutionRules(rules({ surprise: 1 })).ok).toBe(false);
  });
});
