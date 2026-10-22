import { describe, expect, it } from "vite-plus/test";
import { TORPEDO_REASON_CODES } from "../src/torpedoes/reasonCodes.js";
import { REASON_CODES } from "../src/reasonCodes.js";
import { DAMAGE_REASON_CODES } from "../src/damage/reasonCodes.js";

const DESIGN_40_SECTION_29_CODES = [
  "INVALID_TORPEDO_MODEL_DEFINITION",
  "INVALID_TORPEDO_LAUNCHER_STATE",
  "TORPEDO_MODEL_INCOMPATIBLE",
  "TORPEDO_AMMUNITION_UNAVAILABLE",
  "TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED",
  "TORPEDO_LAUNCH_AUTHORITY_DENIED",
  "TORPEDO_TARGET_CONTACT_INSUFFICIENT",
  "TORPEDO_FIRE_SOLUTION_INSUFFICIENT",
  "TORPEDO_LAUNCH_ARC_INVALID",
  "TORPEDO_LAUNCH_SPEED_LIMIT_MISSING",
  "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED",
  "TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED",
  "TORPEDO_LAUNCH_FAILURE",
  "TORPEDO_DUD",
  "TORPEDO_HIT_RESOLVED",
  "TORPEDO_PROGRESSIVE_FLOODING_CREATED",
  "TORPEDO_MACHINERY_DAMAGE_CREATED",
  "TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED",
  "UNDERWATER_TUBE_SEVERE_FLOODING",
  "TORPEDO_CHAIN_REACTION",
  "TORPEDO_STATE_INVARIANT_FAILED",
] as const;

const IN_SLICE_SECTION_29_CODES = [
  "INVALID_TORPEDO_MODEL_DEFINITION",
  "INVALID_TORPEDO_LAUNCHER_STATE",
  "TORPEDO_MODEL_INCOMPATIBLE",
  "TORPEDO_AMMUNITION_UNAVAILABLE",
  "TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED",
  "TORPEDO_LAUNCH_AUTHORITY_DENIED",
  "TORPEDO_TARGET_CONTACT_INSUFFICIENT",
  "TORPEDO_FIRE_SOLUTION_INSUFFICIENT",
  "TORPEDO_LAUNCH_ARC_INVALID",
  "TORPEDO_LAUNCH_SPEED_LIMIT_MISSING",
  "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED",
  "TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED",
  "TORPEDO_LAUNCH_FAILURE",
  "TORPEDO_DUD",
  "TORPEDO_HIT_RESOLVED",
  "TORPEDO_PROGRESSIVE_FLOODING_CREATED",
  "TORPEDO_MACHINERY_DAMAGE_CREATED",
  "TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED",
  "UNDERWATER_TUBE_SEVERE_FLOODING",
  "TORPEDO_CHAIN_REACTION",
  "TORPEDO_STATE_INVARIANT_FAILED",
] as const;

const DEFERRED_SECTION_29_FAMILY_CODES = [] as const;

const NON_SECTION_29_IN_SLICE_MARKERS = [
  "TORPEDO_FIRE_SOLUTION_FACTOR_MISSING",
  "TORPEDO_STUCK_IN_TUBE",
] as const;

const RETIRED_MARKER = "TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED" as const;

const REUSED_COMBAT_CATALOG_CODES = [
  "TACTICAL_STATE_INVARIANT_FAILED",
  "TACTICAL_FOG_OF_WAR_VIOLATION",
  "INVALID_TACTICAL_CLOCK",
] as const;
const REUSED_DAMAGE_CATALOG_CODES = [
  "DAMAGE_STATE_INVARIANT_FAILED",
  "SHIP_SINKING",
  "SHIP_FOUNDERED",
  "FIRE_SOURCE_CREATED",
  "FLOODING_SOURCE_CREATED",
] as const;

describe("AC-21: torpedo reason-code set-equality vs DESIGN-40 §29 + existing catalog", () => {
  it("§29 in-slice + deferred partition covers exactly the full §29 list (no gaps, no overlap)", () => {
    const union = new Set([...IN_SLICE_SECTION_29_CODES, ...DEFERRED_SECTION_29_FAMILY_CODES]);
    expect([...union].sort()).toEqual([...DESIGN_40_SECTION_29_CODES].sort());
    expect(union.size).toBe(DESIGN_40_SECTION_29_CODES.length);
  });

  it("ships exactly the in-slice §29 codes plus the documented in-slice markers — nothing more, nothing less", () => {
    const shipped = Object.values(TORPEDO_REASON_CODES).sort();
    const expected = [...IN_SLICE_SECTION_29_CODES, ...NON_SECTION_29_IN_SLICE_MARKERS].sort();
    expect(shipped).toEqual(expected);
  });

  it("ships no deferred §29-family code owned by a later track", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(TORPEDO_REASON_CODES));
    for (const deferred of DEFERRED_SECTION_29_FAMILY_CODES) {
      expect(shipped.has(deferred)).toBe(false);
    }
  });

  it("documents the in-slice markers: the two §12/§10 markers are shipped, the retired INC-2 marker is NOT re-added", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(TORPEDO_REASON_CODES));
    for (const marker of NON_SECTION_29_IN_SLICE_MARKERS) {
      expect(shipped.has(marker)).toBe(true);
    }
    expect(shipped.has(RETIRED_MARKER)).toBe(false);
  });

  it("reused codes are defined once in the shared combat/damage catalogs, not redefined in the torpedo module", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(TORPEDO_REASON_CODES));
    const sharedCatalog: readonly string[] = Object.values(REASON_CODES);
    const damageCatalog: readonly string[] = Object.values(DAMAGE_REASON_CODES);
    for (const reused of REUSED_COMBAT_CATALOG_CODES) {
      expect(shipped.has(reused)).toBe(false);
      expect(sharedCatalog).toContain(reused);
    }
    for (const reused of REUSED_DAMAGE_CATALOG_CODES) {
      expect(shipped.has(reused)).toBe(false);
      expect(damageCatalog).toContain(reused);
    }
  });

  it("the torpedo catalog and the shared combat catalog are disjoint (no duplicate code across both)", () => {
    const torpedoSet = new Set(Object.values(TORPEDO_REASON_CODES));
    const sharedSet: ReadonlySet<string> = new Set(Object.values(REASON_CODES));
    const damageSet: ReadonlySet<string> = new Set(Object.values(DAMAGE_REASON_CODES));
    for (const code of torpedoSet) {
      expect(sharedSet.has(code)).toBe(false);
      expect(damageSet.has(code)).toBe(false);
    }
  });
});
