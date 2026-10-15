import { describe, expect, it } from "vite-plus/test";
import {
  ARCHETYPE_DIMENSION_MAX,
  ARCHETYPE_DIMENSION_MIN,
  ARCHETYPE_POINT_TOTAL,
  ARCHETYPE_PRESETS,
  BALANCED_ALLOCATION,
  allocationTotal,
  archetypeEffects,
  defaultArchetypeSelection,
  differenceFromBalanced,
  findPreset,
  serializeArchetypeSelection,
  validateArchetypeAllocation,
} from "../src/archetype.js";

describe("BALANCED_ALLOCATION", () => {
  it("matches the pre-existing screen-state test's expected value", () => {
    expect(BALANCED_ALLOCATION).toEqual({ economy: 7, industry: 7, combat: 6 });
    expect(allocationTotal(BALANCED_ALLOCATION)).toBe(ARCHETYPE_POINT_TOTAL);
  });
});

describe("ARCHETYPE_PRESETS", () => {
  it("has the three presets named by archetypeNationSynergy.ts, each totaling the point budget", () => {
    expect(ARCHETYPE_PRESETS.map((p) => p.id)).toEqual([
      "merchant_prince",
      "shipyard_baron",
      "grand_admiral",
    ]);
    for (const preset of ARCHETYPE_PRESETS) {
      expect(allocationTotal(preset.allocation)).toBe(ARCHETYPE_POINT_TOTAL);
    }
  });
});

describe("findPreset", () => {
  it("finds a preset by id", () => {
    expect(findPreset("merchant_prince")).toEqual(ARCHETYPE_PRESETS[0]);
  });

  it("returns undefined for an unknown id", () => {
    expect(findPreset("not-a-real-preset")).toBeUndefined();
  });
});

describe("differenceFromBalanced", () => {
  it("matches the pinned merchant_prince delta", () => {
    expect(differenceFromBalanced({ economy: 10, industry: 5, combat: 5 })).toEqual({
      economy: 3,
      industry: -2,
      combat: -1,
    });
  });
});

describe("validateArchetypeAllocation", () => {
  it("accepts the balanced allocation", () => {
    expect(validateArchetypeAllocation(BALANCED_ALLOCATION)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });

  it("accepts merchant_prince (20 points, within per-dimension bounds)", () => {
    const result = validateArchetypeAllocation({
      economy: 10,
      industry: 5,
      combat: 5,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an allocation that doesn't total the point budget", () => {
    const result = validateArchetypeAllocation({
      economy: 10,
      industry: 3,
      combat: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("rejects a dimension outside [MIN, MAX] even if the total is right", () => {
    const result = validateArchetypeAllocation({
      economy: ARCHETYPE_DIMENSION_MAX + 5,
      industry: ARCHETYPE_DIMENSION_MIN,
      combat: ARCHETYPE_POINT_TOTAL - (ARCHETYPE_DIMENSION_MAX + 5) - ARCHETYPE_DIMENSION_MIN,
    });
    expect(result.ok).toBe(false);
  });
});

describe("archetypeEffects", () => {
  it("matches the pinned merchant_prince numeric effects exactly", () => {
    const effects = archetypeEffects({ economy: 10, industry: 5, combat: 5 });
    expect(effects.treasuryMultiplier).toBeCloseTo(1.24, 10);
    expect(effects.appropriationMultiplier).toBeCloseTo(1.24, 10);
    expect(effects.commanderBonus).toBe(-5);
    expect(effects.doctrineBonus).toBe(-4);
  });

  it("is neutral (multiplier 1, bonus 0) for the balanced allocation", () => {
    const effects = archetypeEffects(BALANCED_ALLOCATION);
    expect(effects.treasuryMultiplier).toBe(1);
    expect(effects.appropriationMultiplier).toBe(1);
    expect(effects.shipyardMultiplier).toBe(1);
    expect(effects.commanderBonus).toBe(0);
    expect(effects.doctrineBonus).toBe(0);
  });
});

describe("defaultArchetypeSelection / serializeArchetypeSelection", () => {
  it("defaults to a custom selection at the balanced allocation", () => {
    expect(defaultArchetypeSelection()).toEqual({
      kind: "custom",
      allocation: BALANCED_ALLOCATION,
    });
  });

  it("round-trips a preset selection through serialization", () => {
    const preset = ARCHETYPE_PRESETS[0]!;
    const selection = {
      kind: "preset" as const,
      id: preset.id,
      allocation: preset.allocation,
    };
    expect(serializeArchetypeSelection(selection)).toContain(preset.id);
  });

  it("serializes canonically, independent of key insertion order", () => {
    const selection = {
      kind: "custom" as const,
      allocation: { economy: 7, industry: 7, combat: 6 },
    };
    const reordered = {
      allocation: { combat: 6, industry: 7, economy: 7 },
      kind: "custom" as const,
    };
    expect(serializeArchetypeSelection(selection)).toBe(serializeArchetypeSelection(reordered));
    expect(serializeArchetypeSelection(selection)).toBe(
      '{"allocation":{"combat":6,"economy":7,"industry":7},"kind":"custom"}',
    );
  });
});
