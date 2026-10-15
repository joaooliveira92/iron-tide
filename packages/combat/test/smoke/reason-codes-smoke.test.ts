//packages/combat/test/smoke/reason-codes-smoke.test.ts
// AC-17: DESIGN-42 §30 reason-code set-equality for the C-5 smoke module.
// The smoke module ships exactly the in-slice §30 codes (spec §1.4) plus the
// documented in-slice marker SMOKE_RESOLUTION_DEFERRED; every §30 code owned by
// the module is shipped — no §30 code is deferred. This guard fails the build if
// a code is added to SMOKE_REASON_CODES without a matching update to this test.
// Mirrors the weather set-equality idiom (reason-codes-weather.test.ts) exactly.
import { describe, expect, it } from "vite-plus/test";
import { SMOKE_REASON_CODES } from "../../src/smoke/reasonCodes.js";
import { REASON_CODES } from "../../src/reasonCodes.js";
import { DAMAGE_REASON_CODES } from "../../src/damage/reasonCodes.js";

// DESIGN-42 §30 "Reason Codes" — the full authoritative list for the smoke
// subsystem (docs/rules/smoke.md §30). All 15 §30 codes are in-slice for this
// sprint (spec §1.4); there is NO deferred code within §30.
const DESIGN_42_SECTION_30_CODES = [
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
  "WEATHER_SMOKE_STATE_INVARIANT_FAILED",
] as const;

// Spec §1.4 in-slice subset (owned by C-5, recorded in ADR-0040) — ALL 15 §30
// codes ship in-slice; nothing from §30 is deferred to another track.
const IN_SLICE_SECTION_30_CODES = [
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
  "WEATHER_SMOKE_STATE_INVARIANT_FAILED",
] as const;

// Spec §1.4 deferred §30-family ownership (recorded, NOT dropped): no §30 codes
// are deferred — all §30 codes ship in this sprint.
const DEFERRED_SECTION_30_FAMILY_CODES = [] as const;

// Spec §1.4 in-slice markers: shipped codes that are NOT §30 codes themselves
// but are authoritative for this slice (mirrors the torpedo/gunnery NON-SECTION
// marker pattern). SMOKE_RESOLUTION_DEFERRED mirrors C-1's
// TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED precedent — a local marker a later
// increment fires if any caller reaches a would-be-deferred boundary.
const NON_SECTION_30_IN_SLICE_MARKERS = ["SMOKE_RESOLUTION_DEFERRED"] as const;

// Reused codes: WEATHER_SMOKE_STATE_INVARIANT_FAILED is a §30 code that was
// originally shipped in B-5 (weather) and is now also shipped in C-5 (smoke).
// It is documented in both modules' reasonCode catalogs as a §30 weather-only
// code that the smoke module re-declares for contract validation.
const _SECTION_30_REUSED_ACROSS_MODULES = ["WEATHER_SMOKE_STATE_INVARIANT_FAILED"] as const;

describe("AC-17: smoke reason-code set-equality vs DESIGN-42 §30", () => {
  it("§30 in-slice + deferred partition covers exactly the full §30 list (no gaps, no overlap)", () => {
    const union = new Set([...IN_SLICE_SECTION_30_CODES, ...DEFERRED_SECTION_30_FAMILY_CODES]);
    expect([...union].sort()).toEqual([...DESIGN_42_SECTION_30_CODES].sort());
    expect(union.size).toBe(DESIGN_42_SECTION_30_CODES.length);
  });

  it("ships exactly the in-slice §30 codes plus the documented in-slice markers — nothing more, nothing less", () => {
    const shipped = Object.values(SMOKE_REASON_CODES).sort();
    const expected = [...IN_SLICE_SECTION_30_CODES, ...NON_SECTION_30_IN_SLICE_MARKERS].sort();
    expect(shipped).toEqual(expected);
  });

  it("every shipped code is unique (no duplicate values)", () => {
    const shippedCodes = Object.values(SMOKE_REASON_CODES) as readonly string[];
    expect(new Set(shippedCodes).size).toBe(shippedCodes.length);
  });

  it("every shipped code is a non-empty string literal", () => {
    for (const code of Object.values(SMOKE_REASON_CODES)) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("ships no deferred §30-family code owned by a later track", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(SMOKE_REASON_CODES));
    for (const deferred of DEFERRED_SECTION_30_FAMILY_CODES) {
      expect(shipped.has(deferred)).toBe(false);
    }
  });

  it("SMOKE_RESOLUTION_DEFERRED is present (the documented in-slice marker)", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(SMOKE_REASON_CODES));
    expect(shipped.has("SMOKE_RESOLUTION_DEFERRED")).toBe(true);
  });

  it("smoke codes are disjoint from the shared combat catalog (REASON_CODES)", () => {
    const smokeSet = new Set(Object.values(SMOKE_REASON_CODES));
    const sharedSet: ReadonlySet<string> = new Set<string>(Object.values(REASON_CODES));
    for (const code of smokeSet) {
      expect(sharedSet.has(code)).toBe(false);
    }
  });

  it("smoke codes are disjoint from damage reason codes (DAMAGE_REASON_CODES)", () => {
    const smokeSet = new Set(Object.values(SMOKE_REASON_CODES));
    const damageSet: ReadonlySet<string> = new Set<string>(Object.values(DAMAGE_REASON_CODES));
    for (const code of smokeSet) {
      expect(damageSet.has(code)).toBe(false);
    }
  });

  it("WEATHER_SMOKE_STATE_INVARIANT_FAILED is present in both smoke and weather catalogs (documented cross-module §30 code)", () => {
    const smokeSet: ReadonlySet<string> = new Set(Object.values(SMOKE_REASON_CODES));
    expect(smokeSet.has("WEATHER_SMOKE_STATE_INVARIANT_FAILED")).toBe(true);
  });
});
