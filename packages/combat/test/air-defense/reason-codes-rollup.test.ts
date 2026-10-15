// packages/combat/test/air-defense/reason-codes-rollup.test.ts
// AC-16 (INC-5): §28 reason-code set-equality — exactly 20 shipped + 6 SAM deferred markers
// + 1 boundary code. Verbatim names and order pinned to DESIGN-45 §28 lines 459-478.
import { describe, expect, it } from "vite-plus/test";
import {
  AIR_DEFENSE_REASON_CODE_SET,
  AIR_DEFENSE_REASON_CODES_BOUNDARY,
  AIR_DEFENSE_REASON_CODES_DEFERRED,
  AIR_DEFENSE_REASON_CODES_SHIPPED,
  AIR_DEFENSE_REASON_CODES_VERSION,
  AIR_DEFENSE_SHIPPED_REASON_CODE_LIST,
  INVALID_AIR_DEFENSE_ATTACK,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
  CAP_INTERCEPTION_INELIGIBLE,
  CAP_EXHAUSTED,
  AIR_ATTACK_DISRUPTED,
  AIR_ATTACK_ABORTED,
} from "../../src/air-defense/index.js";

// DESIGN-45 §28 lines 459-478, verbatim and in document order.
const SHIPPED_SPEC_CODES = [
  "INVALID_AIR_DEFENSE_STATE",
  "INVALID_AIR_DEFENSE_SYSTEM_DEFINITION",
  "AIR_DEFENSE_TARGET_INELIGIBLE",
  "AIR_DEFENSE_CHANNEL_UNAVAILABLE",
  "AIR_DEFENSE_DIRECTOR_UNAVAILABLE",
  "AIR_DEFENSE_RADAR_UNAVAILABLE",
  "AIR_DEFENSE_AMMUNITION_UNAVAILABLE",
  "HEAVY_AA_PROTECTED_RADIUS_EXCEEDED",
  "MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED",
  "LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED",
  "AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED",
  "RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE",
  "RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE",
  "CIWS_DIMINISHING_RETURNS_ACTIVE",
  "CIWS_STRONG_REDUNDANCY_ACTIVE",
  "CAP_INTERCEPTION_INELIGIBLE",
  "CAP_EXHAUSTED",
  "AIR_ATTACK_DISRUPTED",
  "AIR_ATTACK_ABORTED",
  "AIR_DEFENSE_INVARIANT_FAILED",
] as const;

// Ticket 05 deferred SAM markers, verbatim.
const DEFERRED_SPEC_CODES = [
  "HEAVY_SAM_ENGAGEMENT_DEFERRED",
  "HEAVY_SAM_ELIGIBILITY_DEFERRED",
  "MEDIUM_SAM_ENGAGEMENT_DEFERRED",
  "MEDIUM_SAM_ELIGIBILITY_DEFERRED",
  "LIGHT_SAM_ENGAGEMENT_DEFERRED",
  "LIGHT_SAM_ELIGIBILITY_DEFERRED",
] as const;

// Codes shipped before INC-5 (13 in reasonCodes.ts + 2 boundary codes in constants.ts).
const PRIOR_SHIPPED_CODES = [
  "AIR_DEFENSE_TARGET_INELIGIBLE",
  "AIR_DEFENSE_CHANNEL_UNAVAILABLE",
  "AIR_DEFENSE_DIRECTOR_UNAVAILABLE",
  "AIR_DEFENSE_RADAR_UNAVAILABLE",
  "AIR_DEFENSE_AMMUNITION_UNAVAILABLE",
  "HEAVY_AA_PROTECTED_RADIUS_EXCEEDED",
  "MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED",
  "AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED",
  "RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE",
  "RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE",
  "CIWS_DIMINISHING_RETURNS_ACTIVE",
  "CIWS_STRONG_REDUNDANCY_ACTIVE",
  "AIR_DEFENSE_INVARIANT_FAILED",
  "INVALID_AIR_DEFENSE_STATE",
  "INVALID_AIR_DEFENSE_SYSTEM_DEFINITION",
];

describe("AC-16: §28 reason-code set-equality", () => {
  it("ships exactly the 20 spec-defined reason codes", () => {
    const shippedValues = Object.values(AIR_DEFENSE_REASON_CODES_SHIPPED) as string[];
    for (const code of SHIPPED_SPEC_CODES) {
      expect(shippedValues).toContain(code);
    }
    expect(shippedValues.length).toBe(SHIPPED_SPEC_CODES.length);
  });

  it("AIR_DEFENSE_SHIPPED_REASON_CODE_LIST is the 20 codes in exact §28 document order", () => {
    expect(AIR_DEFENSE_SHIPPED_REASON_CODE_LIST.length).toBe(SHIPPED_SPEC_CODES.length);
    for (let i = 0; i < SHIPPED_SPEC_CODES.length; i++) {
      expect(AIR_DEFENSE_SHIPPED_REASON_CODE_LIST[i]).toBe(SHIPPED_SPEC_CODES[i]);
    }
  });

  it("Object.values(shipped) matches the shipped list exactly (no extras, no reordering)", () => {
    expect(Object.values(AIR_DEFENSE_REASON_CODES_SHIPPED)).toEqual([
      ...AIR_DEFENSE_SHIPPED_REASON_CODE_LIST,
    ]);
  });

  it("AIR_DEFENSE_REASON_CODE_SET has exactly 20 entries, all reachable", () => {
    expect(AIR_DEFENSE_REASON_CODE_SET.size).toBe(20);
    for (const code of SHIPPED_SPEC_CODES) {
      expect(AIR_DEFENSE_REASON_CODE_SET.has(code)).toBe(true);
    }
  });

  it("shipped set has no extra entries beyond the spec-defined 20", () => {
    const values = Object.values(AIR_DEFENSE_REASON_CODES_SHIPPED) as string[];
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
    for (const v of unique) {
      expect(SHIPPED_SPEC_CODES).toContain(v);
    }
  });

  it("deferred set has exactly the 6 SAM markers, verbatim", () => {
    const deferredValues = Object.values(AIR_DEFENSE_REASON_CODES_DEFERRED) as string[];
    expect(deferredValues.length).toBe(DEFERRED_SPEC_CODES.length);
    for (const code of DEFERRED_SPEC_CODES) {
      expect(deferredValues).toContain(code);
    }
  });

  it("deferred markers are NOT in the shipped set and no shipped code mentions SAM", () => {
    const deferredValues = Object.values(AIR_DEFENSE_REASON_CODES_DEFERRED) as string[];
    for (const deferred of deferredValues) {
      expect(AIR_DEFENSE_REASON_CODE_SET.has(deferred)).toBe(false);
    }
    for (const shipped of Object.values(AIR_DEFENSE_REASON_CODES_SHIPPED) as string[]) {
      expect(shipped.includes("SAM")).toBe(false);
      expect(deferredValues).not.toContain(shipped);
    }
  });

  it("previously shipped codes are not removed (all 15 prior INC-1..INC-4 codes present)", () => {
    for (const code of PRIOR_SHIPPED_CODES) {
      expect(AIR_DEFENSE_REASON_CODE_SET.has(code)).toBe(true);
    }
  });

  it("newly shipped INC-5 codes are present", () => {
    for (const code of [
      LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
      CAP_INTERCEPTION_INELIGIBLE,
      CAP_EXHAUSTED,
      AIR_ATTACK_DISRUPTED,
      AIR_ATTACK_ABORTED,
    ]) {
      expect(AIR_DEFENSE_REASON_CODE_SET.has(code)).toBe(true);
    }
  });

  it("INVALID_AIR_DEFENSE_ATTACK is retained as a documented boundary code but NOT shipped", () => {
    expect(INVALID_AIR_DEFENSE_ATTACK).toBe("INVALID_AIR_DEFENSE_ATTACK");
    expect(AIR_DEFENSE_REASON_CODES_BOUNDARY).toEqual({
      INVALID_AIR_DEFENSE_ATTACK: "INVALID_AIR_DEFENSE_ATTACK",
    });
    expect(AIR_DEFENSE_REASON_CODE_SET.has("INVALID_AIR_DEFENSE_ATTACK")).toBe(false);
  });

  it("version constant is the versioned catalog id", () => {
    expect(AIR_DEFENSE_REASON_CODES_VERSION).toBe("air_defense_reason_codes_v1");
  });
});
