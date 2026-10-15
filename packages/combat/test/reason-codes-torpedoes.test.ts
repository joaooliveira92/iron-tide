// AC-21: DESIGN-40 §29 reason-code set-equality for the C-1 torpedo slice. The
// torpedo module ships exactly the in-slice §29 codes (spec §1.4) plus the
// documented in-slice markers; every §29-family code owned by a later track is
// recorded as deferred, never shipped here silently. This guard fails the build
// if a code is added to TORPEDO_REASON_CODES without a matching update to this
// test (and, per policy, an ADR entry). Mirrors the gunnery set-equality idiom
// (reason-codes-gunnery.test.ts) exactly.
import { describe, expect, it } from "vite-plus/test";
import { TORPEDO_REASON_CODES } from "../src/torpedoes/reasonCodes.js";
import { REASON_CODES } from "../src/reasonCodes.js";
import { DAMAGE_REASON_CODES } from "../src/damage/reasonCodes.js";

// DESIGN-40 §29 "Required Reason Codes" — the full authoritative list for the
// torpedo subsystem (docs/rules/torpedoes.md §29). All 21 are in-slice for this
// fire-resolution slice (spec §1.4); there is NO deferred code within §29.
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

// Spec §1.4 in-slice subset (owned by C-1, recorded in ADR-0029) — ALL 21 §29
// codes ship in-slice; nothing from §29 is deferred to another track.
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

// Spec §1.4 deferred §29-family ownership (recorded, NOT dropped): submarine-launch
// speed/hazard codes (→ C-3), aerial-torpedo codes (→ D-track), production/
// inventory-delivery + refit codes (→ supply/DESIGN-23 track), command-layer
// manual-launch/division-order codes (→ command slice). None of these families
// is named inside §29 itself, so the named DEFERRED partition within §29 is the
// empty set — the shipped-catalog equality below prevents any of them from being
// silently added here before their owning track ships them.
const DEFERRED_SECTION_29_FAMILY_CODES = [] as const;

// Spec §1.4 in-slice markers: shipped codes that are NOT §29 codes themselves
// but are authoritative for this slice (mirrors the gunnery NON-SECTION marker).
//   - TORPEDO_FIRE_SOLUTION_FACTOR_MISSING: §10 factor-missing failure — the
//     11-factor manifest NEVER falls back to a silent neutral 10_000.
//   - TORPEDO_STUCK_IN_TUBE: §12 mechanical-failure outcome that DOES consume
//     the torpedo (wedged in the tube) — named in the §12 text, not in §29.
const NON_SECTION_29_IN_SLICE_MARKERS = [
  "TORPEDO_FIRE_SOLUTION_FACTOR_MISSING",
  "TORPEDO_STUCK_IN_TUBE",
] as const;

// The INC-2 marker TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED is RETIRED (INC-2 ->
// INC-3): INC-3 ships the REAL §24 friendly-fire family, so no shipped predicate
// reports "DEFERRED" any more. It is recorded in reasonCodes.ts as retired,
// removed from the catalog, and must NEVER be re-added (the §24 family code
// TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED is the authoritative successor).
const RETIRED_MARKER = "TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED" as const;

// Spec §1.4 reused existing combat-catalog codes (no new record needed):
// tactical/clock codes live in the top-level combat catalog (src/reasonCodes.ts);
// damage-pipeline + source-creation codes live in the damage catalog
// (src/damage/reasonCodes.ts). None may be redefined in the torpedo module.
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
    // TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED was retired in INC-3 (the REAL §24
    // family shipped) — re-adding it would be a silent regression.
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
    // NOTE (reviewer LOW-1): the membership-assertion half below couples this
    // torpedo AC-21 test to the damage module's catalog contents (all 5 verified
    // present today). It documents the exact reused-catalog surface the spec
    // §1.4 names; if the damage catalog is later edited/renamed this test fails
    // for an unrelated reason. The disjointness half (next test) is the
    // load-bearing invariant; the membership half is kept for audit clarity.
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
