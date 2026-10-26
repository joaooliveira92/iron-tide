import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  baseSpotValue,
  computeFinalSpotValue,
  type SpotMultiplierInputs,
  determineJetCapability,
  type JetCapabilityPredicates,
  SPOT_VALUE_DENOMINATOR,
  SPOT_CATAPULT_NONE_BP,
  SPOT_CATAPULT_ONE_BP,
  SPOT_CATAPULT_TWO_PLUS_BP,
  SPOT_SPEED_BELOW_20_BP,
  SPOT_SPEED_20_24_BP,
  SPOT_SPEED_24_28_BP,
  SPOT_SPEED_28_PLUS_BP,
  SPOT_DECK_STRAIGHT_BP,
  SPOT_DECK_EDGE_LIFT_BP,
  SPOT_DECK_ANGLED_BP,
  SPOT_DAMAGE_OPERATIONAL_BP,
  SPOT_DAMAGE_DEGRADED_BP,
  SPOT_DAMAGE_HEAVY_BP,
  SPOT_DAMAGE_INOPERABLE_BP,
  SPOT_TECH_BASIC_BP,
  SPOT_TECH_IMPROVED_BP,
  SPOT_TECH_MODERN_BP,
  CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
  JET_CARRIER_CAPABILITIES,
  LIGHT_JET_MIN_DISPLACEMENT_KG,
  LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG,
  HEAVY_JET_MIN_DISPLACEMENT_KG,
  LIGHT_JET_TECHNOLOGY,
  HEAVY_JET_TECHNOLOGY,
} from "@bluewave/combat/carrier-operations";

function defaultSpotInputs(overrides: Partial<SpotMultiplierInputs> = {}): SpotMultiplierInputs {
  return {
    operationalCatapultCount: 0,
    speedKnots: 24,
    deckConfigurationId: "straight_deck",
    flightDeckConditionBp: 10_000,
    technologyLevel: "basic",
    compiledAircraftCapacity: 35,
    ...overrides,
  };
}

describe("AC-7: Base spot value", () => {
  it("capacity 4 has base spot 2", () => {
    expect(Number(baseSpotValue(4))).toBe(2);
  });

  it("capacity 35 has base spot 17", () => {
    expect(Number(baseSpotValue(35))).toBe(17);
  });

  it("capacity 100 has base spot 50", () => {
    expect(Number(baseSpotValue(100))).toBe(50);
  });

  it("capacity 101 has base spot 50 (floor)", () => {
    expect(Number(baseSpotValue(101))).toBe(50);
  });

  it("base spot = floor(capacity / 2) for all values", () => {
    for (const cap of [4, 10, 34, 35, 50, 72, 100, 120]) {
      expect(Number(baseSpotValue(cap))).toBe(Math.floor(cap / 2));
    }
  });
});

describe("AC-8: Spot value modifiers", () => {
  it("all neutral multipliers produce base spot", () => {
    const base = baseSpotValue(35);
    const result = computeFinalSpotValue(base, defaultSpotInputs());
    expect(Number(result)).toBe(17);
  });

  it("catapult multiplier: no catapult = 10_000bp", () => {
    const base = baseSpotValue(35);
    const result = computeFinalSpotValue(base, defaultSpotInputs({ operationalCatapultCount: 2 }));
    expect(Number(result)).toBeGreaterThan(17);
  });

  it("speed < 20kt reduces spot", () => {
    const base = baseSpotValue(35);
    const neutral = computeFinalSpotValue(base, defaultSpotInputs({ speedKnots: 24 }));
    const lowSpeed = computeFinalSpotValue(base, defaultSpotInputs({ speedKnots: 18 }));
    expect(Number(lowSpeed)).toBeLessThan(Number(neutral));
  });

  it("damage inoperable produces spot 0", () => {
    const base = baseSpotValue(35);
    const result = computeFinalSpotValue(base, defaultSpotInputs({ flightDeckConditionBp: 0 }));
    expect(Number(result)).toBe(0);
  });

  it("result is clamped to compiledAircraftCapacity", () => {
    const base = baseSpotValue(4);
    const result = computeFinalSpotValue(
      base,
      defaultSpotInputs({
        compiledAircraftCapacity: 4,
        operationalCatapultCount: 2,
        speedKnots: 28,
        deckConfigurationId: "angled_deck",
        technologyLevel: "modern",
      }),
    );
    expect(Number(result)).toBeLessThanOrEqual(4);
  });

  it("BigInt product produces exact integer result", () => {
    const base = baseSpotValue(35);
    const result = computeFinalSpotValue(base, defaultSpotInputs());
    expect(Number.isInteger(Number(result))).toBe(true);
  });
});

describe("AC-9: Speed-spot interaction", () => {
  it("below 20kt = 6000bp", () => {
    expect(SPOT_SPEED_BELOW_20_BP).toBe(6_000);
  });

  it("20-24kt (below 24) = 8000bp", () => {
    expect(SPOT_SPEED_20_24_BP).toBe(8_000);
  });

  it("24-28kt (below 28) = 10000bp", () => {
    expect(SPOT_SPEED_24_28_BP).toBe(10_000);
  });

  it("28+kt = 11000bp", () => {
    expect(SPOT_SPEED_28_PLUS_BP).toBe(11_000);
  });

  it("exactly 24kt gets 10000bp (no reduction)", () => {
    const base = baseSpotValue(35);
    const neutral = computeFinalSpotValue(base, defaultSpotInputs({ speedKnots: 24 }));
    const baseline = computeFinalSpotValue(base, defaultSpotInputs({ speedKnots: 20 }));
    const faster = computeFinalSpotValue(base, defaultSpotInputs({ speedKnots: 28 }));
    expect(Number(neutral)).toBeGreaterThan(Number(baseline));
    expect(Number(faster)).toBeGreaterThan(Number(neutral));
  });
});

describe("AC-10: Jet carrier capability enum", () => {
  it("has exactly 4 canonical values", () => {
    expect([...JET_CARRIER_CAPABILITIES]).toEqual([
      "NONE",
      "LIGHT_JET_CAPABLE",
      "HEAVY_JET_CAPABLE",
      "MODERN_JET_CAPABLE",
    ]);
  });

  it("determineJetCapability returns NONE for no predicates", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(20_000_000),
      hasCompatibleOperationalSteamCatapult: false,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: false,
      hasAdequateDeckStrengthAndHeatResistance: false,
      adoptedTechnologies: [],
    };
    expect(determineJetCapability(p)).toBe("NONE");
  });
});

describe("AC-11: Light-jet eligibility", () => {
  it("40,000t ship with technology is light-jet capable", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(LIGHT_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: false,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: false,
      hasAdequateDeckStrengthAndHeatResistance: false,
      adoptedTechnologies: [LIGHT_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("LIGHT_JET_CAPABLE");
  });

  it("30,000t ship with catapult + technology is light-jet capable", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG),
      hasCompatibleOperationalSteamCatapult: true,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: false,
      hasAdequateDeckStrengthAndHeatResistance: false,
      adoptedTechnologies: [LIGHT_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("LIGHT_JET_CAPABLE");
  });

  it("30,000t ship without catapult is not light-jet capable", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG),
      hasCompatibleOperationalSteamCatapult: false,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: false,
      hasAdequateDeckStrengthAndHeatResistance: false,
      adoptedTechnologies: [LIGHT_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("NONE");
  });

  it("40,000t ship without technology is not light-jet capable", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(LIGHT_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: false,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: false,
      hasAdequateDeckStrengthAndHeatResistance: false,
      adoptedTechnologies: [],
    };
    expect(determineJetCapability(p)).toBe("NONE");
  });

  it("LIGHT_JET_TECHNOLOGY equals av_carrier_jet", () => {
    expect(LIGHT_JET_TECHNOLOGY).toBe("av_carrier_jet");
  });

  it("LIGHT_JET_MIN_DISPLACEMENT_KG equals 40_000_000", () => {
    expect(LIGHT_JET_MIN_DISPLACEMENT_KG).toBe(40_000_000);
  });

  it("LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG equals 30_000_000", () => {
    expect(LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG).toBe(30_000_000);
  });
});

describe("AC-12: Heavy-jet eligibility", () => {
  it("ships meeting all predicates are at least HEAVY_JET_CAPABLE", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(HEAVY_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: true,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: true,
      hasJetCompatibleLiftsAndHangar: true,
      hasAdequateDeckStrengthAndHeatResistance: true,
      adoptedTechnologies: [HEAVY_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("HEAVY_JET_CAPABLE");
  });

  it("ships with angled deck are MODERN_JET_CAPABLE", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(HEAVY_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: true,
      hasAngledDeck: true,
      hasStrengthenedArrestingGear: true,
      hasJetCompatibleLiftsAndHangar: true,
      hasAdequateDeckStrengthAndHeatResistance: true,
      adoptedTechnologies: [HEAVY_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("MODERN_JET_CAPABLE");
  });

  it("light-jet eligible ships stay LIGHT_JET_CAPABLE without heavy predicates", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(LIGHT_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: false,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: false,
      hasAdequateDeckStrengthAndHeatResistance: false,
      adoptedTechnologies: [LIGHT_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("LIGHT_JET_CAPABLE");
  });

  it("ships without catapult are not heavy-jet capable", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(HEAVY_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: false,
      hasAngledDeck: false,
      hasStrengthenedArrestingGear: true,
      hasJetCompatibleLiftsAndHangar: true,
      hasAdequateDeckStrengthAndHeatResistance: true,
      adoptedTechnologies: [HEAVY_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).not.toBe("HEAVY_JET_CAPABLE");
    expect(determineJetCapability(p)).not.toBe("MODERN_JET_CAPABLE");
  });

  it("ships without strengthening are not heavy-jet capable", () => {
    const p: JetCapabilityPredicates = {
      trueStandardDisplacementKg: SafeInt(HEAVY_JET_MIN_DISPLACEMENT_KG),
      hasCompatibleOperationalSteamCatapult: true,
      hasAngledDeck: true,
      hasStrengthenedArrestingGear: false,
      hasJetCompatibleLiftsAndHangar: true,
      hasAdequateDeckStrengthAndHeatResistance: true,
      adoptedTechnologies: [HEAVY_JET_TECHNOLOGY],
    };
    expect(determineJetCapability(p)).toBe("NONE");
  });

  it("HEAVY_JET_TECHNOLOGY equals modern_jet_carrier_operations", () => {
    expect(HEAVY_JET_TECHNOLOGY).toBe("modern_jet_carrier_operations");
  });

  it("HEAVY_JET_MIN_DISPLACEMENT_KG equals 40_000_000", () => {
    expect(HEAVY_JET_MIN_DISPLACEMENT_KG).toBe(40_000_000);
  });
});

describe("INC-2: Spot modifier constants exact values", () => {
  it("catapult multipliers have correct BP values", () => {
    expect(SPOT_CATAPULT_NONE_BP).toBe(10_000);
    expect(SPOT_CATAPULT_ONE_BP).toBe(11_000);
    expect(SPOT_CATAPULT_TWO_PLUS_BP).toBe(12_000);
  });

  it("deck configuration multipliers have correct BP values", () => {
    expect(SPOT_DECK_STRAIGHT_BP).toBe(10_000);
    expect(SPOT_DECK_EDGE_LIFT_BP).toBe(11_000);
    expect(SPOT_DECK_ANGLED_BP).toBe(12_000);
  });

  it("flight deck damage multipliers have correct BP values", () => {
    expect(SPOT_DAMAGE_OPERATIONAL_BP).toBe(10_000);
    expect(SPOT_DAMAGE_DEGRADED_BP).toBe(7_500);
    expect(SPOT_DAMAGE_HEAVY_BP).toBe(3_500);
    expect(SPOT_DAMAGE_INOPERABLE_BP).toBe(0);
  });

  it("technology multipliers have correct BP values", () => {
    expect(SPOT_TECH_BASIC_BP).toBe(10_000);
    expect(SPOT_TECH_IMPROVED_BP).toBe(11_000);
    expect(SPOT_TECH_MODERN_BP).toBe(12_000);
  });

  it("SPOT_VALUE_DENOMINATOR equals 10_000^6", () => {
    expect(SPOT_VALUE_DENOMINATOR).toBe(BigInt(CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT) ** 6n);
  });
});
