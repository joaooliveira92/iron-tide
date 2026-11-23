import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { PossessionSchema, decodeColonyIncomeRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [
    {
      title: "Rule the Waves 3 manual",
      author: "Naval War Simulations / Matrix Games",
      year: 2023,
      page: "13",
      section: "Budget",
    },
  ],
  note: "PROVISIONAL test fixture",
};

const section = (overrides: Record<string, unknown> = {}) => ({
  sectionVersion: 1,
  baselineYear: 1880,
  startFactorBp: 10_000,
  slopeBpPerYear: 80,
  floorBp: 2_500,
  provenance,
  ...overrides,
});

describe("colony income rules (manual p.13, S-3 D7)", () => {
  it("decodes a linear decay with a floor below the start factor", () => {
    const decoded = decodeColonyIncomeRules(section());
    expect(decoded.ok && decoded.value.slopeBpPerYear).toBe(80);
    expect(decodeColonyIncomeRules(section({ floorBp: 0 })).ok).toBe(true);
    expect(decodeColonyIncomeRules(section({ floorBp: 10_000 })).ok).toBe(true);
  });

  it("rejects a floor above the start factor and out-of-range factors", () => {
    expect(decodeColonyIncomeRules(section({ startFactorBp: 5_000, floorBp: 5_001 })).ok).toBe(
      false,
    );
    expect(decodeColonyIncomeRules(section({ startFactorBp: 10_001 })).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ startFactorBp: 0, floorBp: 0 })).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ floorBp: -1 })).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ slopeBpPerYear: -1 })).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ slopeBpPerYear: 10_001 })).ok).toBe(false);
  });

  it("rejects non-integers and a baseline year outside the campaign calendar", () => {
    expect(decodeColonyIncomeRules(section({ slopeBpPerYear: 0.5 })).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ baselineYear: 1880.5 })).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ baselineYear: 999 })).ok).toBe(false);
  });

  it("requires provenance and rejects excess properties", () => {
    const { provenance: _omitted, ...bare } = section();
    expect(decodeColonyIncomeRules(bare).ok).toBe(false);
    expect(decodeColonyIncomeRules(section({ extra: 1 })).ok).toBe(false);
  });
});

describe("possession colonyValueBp", () => {
  const decode = (input: unknown) =>
    Schema.decodeUnknownResult(PossessionSchema)(input, { onExcessProperty: "error" });

  const base = { id: "poss_x", nationId: "uk", areaId: "a" };

  it("leaves the value optional so existing possessions decode unchanged", () => {
    expect(decode(base)._tag).toBe("Success");
  });

  it("accepts an integer value between 1 and 1000 bp with provenance", () => {
    expect(decode({ ...base, colonyValueBp: 40, provenance })._tag).toBe("Success");
    expect(decode({ ...base, colonyValueBp: 1_000, provenance })._tag).toBe("Success");
  });

  it("rejects zero, negative, fractional and oversized values", () => {
    for (const colonyValueBp of [0, -5, 0.5, 1_001])
      expect(decode({ ...base, colonyValueBp, provenance })._tag).toBe("Failure");
  });

  it("requires provenance when a value is authored", () => {
    expect(decode({ ...base, colonyValueBp: 40 })._tag).toBe("Failure");
  });
});
