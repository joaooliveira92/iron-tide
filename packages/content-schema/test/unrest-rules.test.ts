import { describe, expect, it } from "vite-plus/test";
import { decodeUnrestRules } from "../src/index.js";

const base = {
  sectionVersion: 1,
  referenceRateBp: 2_000,
  spendingStepBp: 500,
  spendingMaxRise: 2,
  spendingMaxCut: 1,
  warOutbreakRelief: 1,
  warDurationMonths: 12,
  warDurationRise: 1,
  blockadeRise: 1,
  defeatRise: 1,
  victoryRelief: 1,
  crampedWarRise: 1,
  crampedBlockadeRise: 1,
  strikeThreshold: 7,
  strikeRateStepBp: 250,
  revolutionThreshold: 9,
  revolutionProbabilityBp: 1_500,
  liberalDemocracyDampingBp: 4_000,
  aftermathUnrest: 5,
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [
      {
        title: "Rule the Waves 3 manual",
        author: "Naval War Simulations / Matrix Games",
        year: 2023,
        page: "60, 62",
        section: "Unrest and government type",
      },
    ],
    note: "PROVISIONAL test fixture",
  },
};

const table = {
  liberal_democracy: "communist",
  limited_democracy: "fascist",
  autocratic: "communist",
  fascist: "limited_democracy",
  communist: "autocratic",
  eastern: "limited_democracy",
};

describe("unrest rules government table (#1018)", () => {
  it("decodes a section recorded without a table", () => {
    expect(decodeUnrestRules(base)).toMatchObject({ ok: true });
  });

  it("decodes a complete table", () => {
    const decoded = decodeUnrestRules({ ...base, governmentAfterRevolution: table });
    expect(decoded).toMatchObject({ ok: true });
  });

  it("rejects a table missing a government type", () => {
    const { eastern: _eastern, ...partial } = table;
    const decoded = decodeUnrestRules({ ...base, governmentAfterRevolution: partial });
    expect(decoded).toMatchObject({ ok: false, field: "governmentAfterRevolution.eastern" });
  });

  it("rejects an unknown successor government", () => {
    const decoded = decodeUnrestRules({
      ...base,
      governmentAfterRevolution: { ...table, eastern: "theocracy" },
    });
    expect(decoded).toMatchObject({ ok: false, field: "governmentAfterRevolution.eastern" });
  });
});
