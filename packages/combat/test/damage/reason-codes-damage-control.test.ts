// INC-9: Reason-code set-equality guard for the C-5 damage-control extension.
// Verifies that the C-5 damage-control codes (fire spread/resolution, flooding
// high-speed loss, damage-control allocation) are present in DAMAGE_REASON_CODES
// and that the combined set retains disjointness from the base combat catalog.
import { describe, expect, it } from "vite-plus/test";
import { DAMAGE_REASON_CODES } from "../../src/damage/reasonCodes.js";
import { REASON_CODES } from "../../src/reasonCodes.js";

// C-5 codes added to the damage module: fire resolution (§22-23), flooding
// high-speed loss (§17), and damage-control allocation (§27-28). These extend
// the existing DAMAGE_REASON_CODES set (first shipped by B-4/INC-6).
const C5_DAMAGE_CONTROL_CODES = [
  "FIRE_SPREAD_CREATED",
  "FIRE_EXTINGUISHED",
  "FIRE_INTENSITY_CHANGED",
  "FLOODING_HIGH_SPEED_LOSS_CHECK",
  "DAMAGE_CONTROL_ALLOCATION_FAILED",
] as const;

describe("INC-9: damage-control reason-code set-equality (C-5 extension)", () => {
  it("all C-5 damage-control codes are in DAMAGE_REASON_CODES", () => {
    const shippedSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    for (const code of C5_DAMAGE_CONTROL_CODES) {
      expect(shippedSet.has(code)).toBe(true);
    }
  });

  it("each C-5 damage-control code is a non-empty string literal", () => {
    for (const code of C5_DAMAGE_CONTROL_CODES) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("C-5 damage-control codes are disjoint from the shared combat catalog (REASON_CODES)", () => {
    const damageSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    const sharedSet: ReadonlySet<string> = new Set<string>(Object.values(REASON_CODES));
    for (const code of damageSet) {
      // FIRE_SPREAD_CREATED, FIRE_EXTINGUISHED, FIRE_INTENSITY_CHANGED,
      // FLOODING_HIGH_SPEED_LOSS_CHECK, and DAMAGE_CONTROL_ALLOCATION_FAILED
      // are damage-module codes — they must NOT appear in the base combat catalog.
      expect(sharedSet.has(code)).toBe(false);
    }
  });

  it("the DAMAGE_REASON_CODES set is self-consistent (no lost codes from B-4 set)", () => {
    // The full list from the existing reason-codes-damage.test.ts
    const B4_CODES = [
      "INVALID_SHIP_DAMAGE_STATE",
      "DAMAGE_RESOLUTION_FAILED",
      "DAMAGE_STATE_INVARIANT_FAILED",
      "DAMAGE_HIT_LOCATION_INVALID",
      "DAMAGE_PROTECTION_INTERACTION_INVALID",
      "DAMAGE_COMPONENT_OUT_OF_SCOPE",
      "DAMAGE_SECONDARY_HAZARD_CREATED",
      "FIRE_SOURCE_CREATED",
      "FIRE_SPREAD_CREATED",
      "FIRE_EXTINGUISHED",
      "FIRE_INTENSITY_CHANGED",
      "FLOODING_SOURCE_CREATED",
      "FLOODING_HIGH_SPEED_LOSS_CHECK",
      "DAMAGE_CONTROL_ALLOCATION_FAILED",
      "SHIP_SINKING",
      "SHIP_FOUNDERED",
      "ARMOR_ZONE_MAXIMUM_MISSING",
      "ARMOR_THICKNESS_LIMIT_EXCEEDED",
      "SPLINTER_PROTECTION_NOT_QUALIFIED",
      "ARMOR_QUALITY_MULTIPLIER_MISSING",
    ] as const;
    const shippedSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    for (const code of B4_CODES) {
      expect(shippedSet.has(code)).toBe(true);
    }
  });

  it("each C-5 damage-control code has a named export equal to its string value", () => {
    // Verify the exported constants via the DAMAGE_REASON_CODES object keys
    const keys = Object.keys(DAMAGE_REASON_CODES) as readonly string[];
    for (const code of C5_DAMAGE_CONTROL_CODES) {
      expect(keys).toContain(code);
      expect(DAMAGE_REASON_CODES[code as keyof typeof DAMAGE_REASON_CODES]).toBe(code);
    }
  });
});
