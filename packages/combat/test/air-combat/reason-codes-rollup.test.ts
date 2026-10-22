import { describe, expect, it } from "vite-plus/test";
import {
  AIR_COMBAT_REASON_CODES_SHIPPED,
  AIR_COMBAT_REASON_CODES_DEFERRED,
  AIR_COMBAT_REASON_CODE_SET,
} from "@bluewave/combat/air-combat";

const SHIPPED_SPEC_CODES = [
  "AIR_COMBAT_INVALID_STATE",
  "AIR_COMBAT_INVALID_STRIKE_TRANSITION",
  "AIR_COMBAT_QUALITY_OUT_OF_RANGE",
  "AIR_COMBAT_ATTACKER_ZERO_STRENGTH",
  "AIR_COMBAT_NO_AVAILABLE_TARGET",
  "AIR_COMBAT_INTERCEPTION_TOO_LATE",
  "AIR_COMBAT_ESCORT_ZERO_STRENGTH",
  "AIR_COMBAT_STRIKE_ZERO_STRENGTH",
  "AIR_COMBAT_DETECTION_FAILED",
  "AIR_COMBAT_BOMBING_PARAMETERS_INVALID",
  "AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE",
  "AIR_COMBAT_ATTACK_NO_DAMAGE",
  "AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT",
  "AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE",
  "AIR_COMBAT_RECORD_INTEGRITY_FAILURE",
  "AIR_COMBAT_INVARIANT_FAILED",
] as const;

const DEFERRED_SPEC_CODES = [
  "AIR_COMBAT_AA_INTERCEPTION_DEFERRED",
  "AIR_COMBAT_EXPERIENCE_MODIFIER_DEFERRED",
  "AIR_COMBAT_FUEL_EXHAUSTION_DEFERRED",
] as const;

describe("AC-19: §1.4 reason-code set-equality", () => {
  it("ships exactly the 16 spec-defined reason codes", () => {
    const shippedValues = Object.values(AIR_COMBAT_REASON_CODES_SHIPPED) as string[];
    for (const code of SHIPPED_SPEC_CODES) {
      expect(shippedValues).toContain(code);
    }
    expect(shippedValues.length).toBe(SHIPPED_SPEC_CODES.length);
  });

  it("AIR_COMBAT_REASON_CODE_SET has exactly 16 entries", () => {
    expect(AIR_COMBAT_REASON_CODE_SET.size).toBe(16);
  });

  it("all shipped codes are reachable in the set", () => {
    for (const code of SHIPPED_SPEC_CODES) {
      expect(AIR_COMBAT_REASON_CODE_SET.has(code)).toBe(true);
    }
  });

  it("deferred markers (3) are NOT in AIR_COMBAT_REASON_CODE_SET", () => {
    for (const deferred of DEFERRED_SPEC_CODES) {
      expect(AIR_COMBAT_REASON_CODE_SET.has(deferred)).toBe(false);
    }
  });

  it("shipped set has no extra entries beyond the spec-defined 16", () => {
    const values = Object.values(AIR_COMBAT_REASON_CODES_SHIPPED) as string[];
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
    for (const v of unique) {
      expect(SHIPPED_SPEC_CODES).toContain(v);
    }
  });

  it("deferred set has exactly 3 entries", () => {
    const deferredValues = Object.values(AIR_COMBAT_REASON_CODES_DEFERRED) as string[];
    expect(deferredValues.length).toBe(3);
  });

  it("no shipped code string starts with any deferred code string (disjointness)", () => {
    const shippedValues = Object.values(AIR_COMBAT_REASON_CODES_SHIPPED) as string[];
    const deferredValues = Object.values(AIR_COMBAT_REASON_CODES_DEFERRED) as string[];
    for (const shipped of shippedValues) {
      for (const deferred of deferredValues) {
        expect(shipped.includes(deferred)).toBe(false);
      }
    }
  });

  it("previously shipped codes not removed (all 14 prior INC-1..INC-6 codes present)", () => {
    const priorCodes = [
      "AIR_COMBAT_INVALID_STATE",
      "AIR_COMBAT_DETECTION_FAILED",
      "AIR_COMBAT_INTERCEPTION_TOO_LATE",
      "AIR_COMBAT_QUALITY_OUT_OF_RANGE",
      "AIR_COMBAT_ATTACKER_ZERO_STRENGTH",
      "AIR_COMBAT_NO_AVAILABLE_TARGET",
      "AIR_COMBAT_ESCORT_ZERO_STRENGTH",
      "AIR_COMBAT_STRIKE_ZERO_STRENGTH",
      "AIR_COMBAT_INVALID_STRIKE_TRANSITION",
      "AIR_COMBAT_BOMBING_PARAMETERS_INVALID",
      "AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE",
      "AIR_COMBAT_ATTACK_NO_DAMAGE",
      "AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT",
      "AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE",
    ];
    for (const code of priorCodes) {
      expect(AIR_COMBAT_REASON_CODE_SET.has(code)).toBe(true);
    }
  });
});
