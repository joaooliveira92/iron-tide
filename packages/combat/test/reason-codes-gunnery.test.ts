// AC-10: DESIGN-39 §32 reason-code set-equality for the B-3 core surface gunnery
// slice. The gunnery package ships exactly the in-slice §32 codes recorded in
// ADR-0020 (spec §1.4) plus the reused existing combat-catalog codes; every §32
// code owned by a later slice/track is recorded as deferred, never shipped here
// silently. This guard fails the build if a code is added to GUNNERY_REASON_CODES
// without a matching update to this test (and, per policy, an ADR entry).
import { describe, expect, it } from "vite-plus/test";
import { GUNNERY_REASON_CODES } from "../src/gunnery/reasonCodes.js";
import { REASON_CODES } from "../src/reasonCodes.js";

// DESIGN-39 §32 "Required Reason Codes" — the full authoritative list for the
// gunnery subsystem (docs/rules/gunnery.md §32).
const DESIGN_39_SECTION_32_CODES = [
  "INVALID_GUNNERY_STATE",
  "GUNNERY_ACCURACY_FACTOR_MISSING",
  "GUNNERY_RATE_FACTOR_MISSING",
  "GUN_QUALITY_OUT_OF_RANGE",
  "AUTOLOADER_TECHNOLOGY_UNAVAILABLE",
  "AUTOLOADER_MOUNT_INELIGIBLE",
  "AUTOLOADER_FEED_JAMMED",
  "DUAL_PURPOSE_GUN_CONTRACT_MISSING",
  "DUAL_PURPOSE_ROLE_SWITCHING",
  "DUAL_PURPOSE_AA_INELIGIBLE",
  "ARMOR_ZONE_MAXIMUM_MISSING",
  "ARMOR_THICKNESS_LIMIT_EXCEEDED",
  "ARMOR_MANUFACTURING_POLICY_MISSING",
  "SPLINTER_PROTECTION_NOT_QUALIFIED",
  "GUNNERY_TARGET_ILLEGAL",
  "GUNNERY_AMMUNITION_UNAVAILABLE",
  "GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT",
  "GUNNERY_STRADDLE_INVALID",
  "GUNNERY_STATE_INVARIANT_FAILED",
] as const;

// Spec §1.4 in-slice subset (owned by B-3, recorded in ADR-0020) — a proper
// subset of §32.
const IN_SLICE_SECTION_32_CODES = [
  "INVALID_GUNNERY_STATE",
  "GUNNERY_ACCURACY_FACTOR_MISSING",
  "GUNNERY_RATE_FACTOR_MISSING",
  "GUN_QUALITY_OUT_OF_RANGE",
  "GUNNERY_AMMUNITION_UNAVAILABLE",
  "GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT",
  "GUNNERY_STATE_INVARIANT_FAILED",
] as const;

// Spec §1.4 deferred subset — owned by later slices/tracks; recorded, not shipped.
const DEFERRED_SECTION_32_CODES = [
  "AUTOLOADER_TECHNOLOGY_UNAVAILABLE",
  "AUTOLOADER_MOUNT_INELIGIBLE",
  "AUTOLOADER_FEED_JAMMED",
  "DUAL_PURPOSE_GUN_CONTRACT_MISSING",
  "DUAL_PURPOSE_ROLE_SWITCHING",
  "DUAL_PURPOSE_AA_INELIGIBLE",
  "ARMOR_ZONE_MAXIMUM_MISSING",
  "ARMOR_THICKNESS_LIMIT_EXCEEDED",
  "ARMOR_MANUFACTURING_POLICY_MISSING",
  "SPLINTER_PROTECTION_NOT_QUALIFIED",
  "GUNNERY_TARGET_ILLEGAL",
  "GUNNERY_STRADDLE_INVALID",
] as const;

// Spec §1.4 reused existing combat-catalog codes (no new record needed).
const REUSED_COMBAT_CATALOG_CODES = [
  "TACTICAL_STATE_INVARIANT_FAILED",
  "TACTICAL_FOG_OF_WAR_VIOLATION",
  "INVALID_TACTICAL_CLOCK",
  "INVALID_TACTICAL_TIME_CONTRACT",
] as const;

// The one in-slice code that is NOT a §32 code: the deferred-eligibility-predicate
// marker (RAPID/AA_TRACKING/AA_BARRAGE eligibility predicates are deferred, spec
// §1.4 / ADR-0020) — a firing guard reports this rather than fabricating a §32 code.
const NON_SECTION_32_IN_SLICE_MARKER = "GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED";

describe("AC-10: gunnery reason-code set-equality vs DESIGN-39 §32 + existing catalog", () => {
  it("§32 in-slice + deferred partition covers exactly the full §32 list (no gaps, no overlap)", () => {
    const union = new Set([...IN_SLICE_SECTION_32_CODES, ...DEFERRED_SECTION_32_CODES]);
    expect([...union].sort()).toEqual([...DESIGN_39_SECTION_32_CODES].sort());
    expect(union.size).toBe(DESIGN_39_SECTION_32_CODES.length);
  });

  it("ships exactly the in-slice §32 codes plus the deferred-predicate marker — nothing more, nothing less", () => {
    const shipped = Object.values(GUNNERY_REASON_CODES).sort();
    const expected = [...IN_SLICE_SECTION_32_CODES, NON_SECTION_32_IN_SLICE_MARKER].sort();
    expect(shipped).toEqual(expected);
  });

  it("ships no deferred §32 code owned by a later slice/track", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(GUNNERY_REASON_CODES));
    for (const deferred of DEFERRED_SECTION_32_CODES) {
      expect(shipped.has(deferred)).toBe(false);
    }
  });

  it("reused codes are defined once in the shared combat catalog, not redefined in the gunnery module", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(GUNNERY_REASON_CODES));
    const sharedCatalog: readonly string[] = Object.values(REASON_CODES);
    for (const reused of REUSED_COMBAT_CATALOG_CODES) {
      expect(shipped.has(reused)).toBe(false);
      expect(sharedCatalog).toContain(reused);
    }
  });

  it("the gunnery catalog and the shared combat catalog are disjoint (no duplicate code across both)", () => {
    const gunnerySet = new Set(Object.values(GUNNERY_REASON_CODES));
    const sharedSet: ReadonlySet<string> = new Set(Object.values(REASON_CODES));
    for (const code of gunnerySet) {
      expect(sharedSet.has(code)).toBe(false);
    }
  });
});
