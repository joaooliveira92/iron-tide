// AC-16: Reason-code set-equality — the shipped WEATHER_REASON_CODES set must
// exactly match the §30 weather-only subset plus the non-§30 in-slice markers
// (INVALID_STRATEGIC_WEATHER_STATE, INVALID_TACTICAL_WEATHER_STATE,
// WEATHER_STATE_INVARIANT_FAILED). Adding a code without updating this test
// fails the guard. Every shipped code is a non-empty string literal; the shipped
// set is disjoint from the shared combat catalog; deferred §30 smoke codes
// (owned by M3/C-5) are never shipped here.
import { describe, it, expect } from "vite-plus/test";
import { WEATHER_REASON_CODES } from "../src/weather/reasonCodes.js";
import { REASON_CODES } from "../src/reasonCodes.js";

// Full authoritative list of in-slice weather codes per spec §1.4 + ADR-0022:
// - 4 §30 weather-only codes (smoke codes deferred)
// - 3 non-§30 in-slice markers (strategic/tactical construction + invariant guards)
const IN_SLICE_CODES = [
  "WEATHER_PROFILE_INCOMPLETE",
  "INVALID_BATTLE_WEATHER_INITIALIZATION",
  "WEATHER_VISIBILITY_FORMULA_MISSING",
  "WEATHER_SMOKE_STATE_INVARIANT_FAILED",
  "INVALID_STRATEGIC_WEATHER_STATE",
  "INVALID_TACTICAL_WEATHER_STATE",
  "WEATHER_STATE_INVARIANT_FAILED",
] as const;

// Deferred §30 codes — owned by M3/C-5 smoke track, never shipped in B-5.
const DEFERRED_SECTION_30_SMOKE_CODES = [
  "INVALID_SMOKE_CLOUD",
  "SMOKE_LINE_INTERSECTION_FAILED",
  "SMOKESCREEN_SHIP_INELIGIBLE",
  "SMOKESCREEN_EQUIPMENT_UNAVAILABLE",
  "SMOKESCREEN_CONSUMABLE_UNAVAILABLE",
  "SMOKESCREEN_COOLDOWN_ACTIVE",
  "SMOKESCREEN_GENERATION_INTERRUPTED",
  "SMOKE_FLOAT_TECHNOLOGY_UNAVAILABLE",
  "SMOKE_FLOAT_CAPACITY_MISSING",
  "SMOKE_FLOAT_INVENTORY_EMPTY",
  "SMOKE_FLOAT_DEPLOYMENT_SPEED_EXCEEDED",
  "SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE",
  "SMOKE_GENERATOR_CHARGES_EMPTY",
  "SMOKE_EQUIPMENT_MODE_CONFLICT",
] as const;

describe("AC-16: weather reason-code set-equality (§30 + non-§30 markers)", () => {
  it("the shipped WEATHER_REASON_CODES set exactly matches IN_SLICE_CODES", () => {
    const shippedCodes = Object.values(WEATHER_REASON_CODES).sort() as readonly string[];
    const expectedCodes = [...IN_SLICE_CODES].sort();
    expect(shippedCodes).toEqual(expectedCodes);
  });

  it("every shipped code is unique (no duplicate values)", () => {
    const shippedCodes = Object.values(WEATHER_REASON_CODES) as readonly string[];
    expect(new Set(shippedCodes).size).toBe(shippedCodes.length);
  });

  it("every shipped code is a non-empty string literal", () => {
    for (const code of Object.values(WEATHER_REASON_CODES)) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("no deferred §30 smoke code is shipped", () => {
    const shippedSet = new Set(Object.values(WEATHER_REASON_CODES) as readonly string[]);
    for (const deferred of DEFERRED_SECTION_30_SMOKE_CODES) {
      expect(shippedSet.has(deferred)).toBe(false);
    }
  });

  it("shipped weather codes are disjoint from the shared combat catalog (REASON_CODES)", () => {
    const weatherSet = new Set(Object.values(WEATHER_REASON_CODES) as readonly string[]);
    const sharedSet: ReadonlySet<string> = new Set<string>(Object.values(REASON_CODES));
    for (const code of weatherSet) {
      expect(sharedSet.has(code)).toBe(false);
    }
  });

  it("reused combat catalog codes are not in weather's set (weather owns its codes)", () => {
    const weatherSet = new Set(Object.values(WEATHER_REASON_CODES) as readonly string[]);
    // Weather does not reuse any combat codes (all weather codes are new)
    // Reused codes would be: TACTICAL_STATE_INVARIANT_FAILED, etc.
    // Weather's invariant guard is WEATHER_STATE_INVARIANT_FAILED — a new code.
    expect(weatherSet.has("TACTICAL_STATE_INVARIANT_FAILED")).toBe(false);
  });

  it("strat and tact construction-boundary codes are in the shipped set", () => {
    const shippedSet = new Set(Object.values(WEATHER_REASON_CODES) as readonly string[]);
    expect(shippedSet.has("INVALID_STRATEGIC_WEATHER_STATE")).toBe(true);
    expect(shippedSet.has("INVALID_TACTICAL_WEATHER_STATE")).toBe(true);
  });
});
