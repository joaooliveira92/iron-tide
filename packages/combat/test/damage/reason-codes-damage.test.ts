import { describe, it, expect } from "vite-plus/test";
import { DAMAGE_REASON_CODES } from "../../src/damage/index.js";
import { REASON_CODES } from "../../src/reasonCodes.js";

const IN_SLICE_CODES = [
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
  "DAMAGE_KEYED_DRAW",
  "DAMAGE_CONTROL_KEYED_DRAW",
] as const;

const DEFERRED_SECTION_47_CODES = [
  "CARRIER_OPERATIONS_OBSTRUCTED_BY_FIRE",
  "ALUMINUM_SUPERSTRUCTURE_FIRE_VULNERABILITY",
  "SHIP_MISSION_KILLED",
  "SHIP_STABILIZED",
  "SHIP_ABANDONED",
  "SHIP_SCUTTLED",
  "SHIP_CAPTURED",
  "SHIP_RECOVERED",
  "SURVIVOR_RESCUE_INELIGIBLE",
  "SURVIVOR_RESCUE_COMPLETED",
  "SINKING_CREDIT_NOT_YET_CONFIRMED",
] as const;

describe("AC-13: reason-code set-equality vs DESIGN-41 §47 + DESIGN-39 §32", () => {
  it("the shipped DAMAGE_REASON_CODES set exactly matches IN_SLICE_CODES", () => {
    const shippedCodes = Object.values(DAMAGE_REASON_CODES).sort() as readonly string[];
    const expectedCodes = [...IN_SLICE_CODES].sort();
    expect(shippedCodes).toEqual(expectedCodes);
  });

  it("every shipped code is unique (no duplicate values)", () => {
    const shippedCodes = Object.values(DAMAGE_REASON_CODES) as readonly string[];
    expect(new Set(shippedCodes).size).toBe(shippedCodes.length);
  });

  it("every shipped code is a non-empty string literal", () => {
    for (const code of Object.values(DAMAGE_REASON_CODES)) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("no deferred §47 code is shipped", () => {
    const shippedSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    for (const deferred of DEFERRED_SECTION_47_CODES) {
      expect(shippedSet.has(deferred)).toBe(false);
    }
  });

  it("shipped damage codes are disjoint from the shared combat catalog (REASON_CODES)", () => {
    const damageSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    const sharedSet: ReadonlySet<string> = new Set<string>(Object.values(REASON_CODES));
    for (const code of damageSet) {
      expect(sharedSet.has(code)).toBe(false);
    }
  });

  it("DAMAGE_SECONDARY_HAZARD_CREATED, FIRE_SOURCE_CREATED, FLOODING_SOURCE_CREATED are in the shipped set", () => {
    const shippedSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    expect(shippedSet.has("DAMAGE_SECONDARY_HAZARD_CREATED")).toBe(true);
    expect(shippedSet.has("FIRE_SOURCE_CREATED")).toBe(true);
    expect(shippedSet.has("FLOODING_SOURCE_CREATED")).toBe(true);
  });

  it("ARMOR_QUALITY_MULTIPLIER_MISSING is in the shipped set", () => {
    const shippedSet = new Set(Object.values(DAMAGE_REASON_CODES) as readonly string[]);
    expect(shippedSet.has("ARMOR_QUALITY_MULTIPLIER_MISSING")).toBe(true);
  });
});
