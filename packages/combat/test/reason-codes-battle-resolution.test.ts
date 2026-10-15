// AC-13: reason-code set-equality for the B-6 battle auto-resolution slice
// (DESIGN-38 §33/§36/§37; DESIGN-37 §44 auto-resolution codes are reused, not
// redefined). Mirrors reason-codes-gunnery / reason-codes-damage /
// reason-codes-weather. The guard fails the build if a code is added to
// BATTLE_RESOLUTION_REASON_CODES without a matching update here (and, per
// policy, an ADR-0026 entry).
import { describe, expect, it } from "vite-plus/test";
import { BATTLE_RESOLUTION_REASON_CODES } from "../src/battleResolution/reasonCodes.js";
import { REASON_CODES } from "../src/reasonCodes.js";
import { GENERATION_REASON_CODES } from "../src/generation/reasonCodes.js";

// DESIGN-38 §36 "Required Reason Codes" — the full authoritative tactical
// combat list (docs/rules/tactical-combat.md §36).
const DESIGN_38_SECTION_36_CODES = [
  "INVALID_TACTICAL_TIME_CONTRACT",
  "INVALID_TACTICAL_CLOCK",
  "TACTICAL_COMMAND_AFTER_CUTOFF",
  "INVALID_TACTICAL_COMMAND_TRANSITION",
  "TACTICAL_COMMAND_AUTHORITY_DENIED",
  "TACTICAL_COMMAND_OUT_OF_REACH",
  "TACTICAL_COMMAND_TRANSMISSION_FAILED",
  "TACTICAL_REALISM_COMMAND_PROHIBITED",
  "TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING",
  "TACTICAL_FOG_OF_WAR_VIOLATION",
  "BATTLE_TURN_AWAY_TECHNOLOGY_UNAVAILABLE",
  "BATTLE_TURN_AWAY_INELIGIBLE",
  "BATTLE_TURN_AWAY_CONFUSION",
  "BATTLE_TURN_AWAY_ABORTED",
  "BATTLE_WITHDRAWAL_INCOMPLETE",
  "BATTLE_EXIT_ZONE_INELIGIBLE",
  "AUTO_RESOLUTION_UNAVAILABLE",
  "AUTO_RESOLUTION_VALIDATION_FAILED",
  "TACTICAL_STATE_INVARIANT_FAILED",
] as const;

// The §36 auto-resolution codes are REUSED from the shared combat catalog and
// the generation catalog (both already shipped) — the battle-resolution module
// must NOT redefine them.
const REUSED_AUTO_RESOLUTION_CODES = [
  "AUTO_RESOLUTION_UNAVAILABLE",
  "AUTO_RESOLUTION_VALIDATION_FAILED",
] as const;

const REUSED_COMBAT_CATALOG_CODES = ["TACTICAL_STATE_INVARIANT_FAILED"] as const;

// The two in-slice markers owned by this slice (non-§36, recorded in
// ADR-0026): run-level failures and viability-predicate failures.
const IN_SLICE_MARKERS = [
  "BATTLE_AUTO_RESOLUTION_FAILED",
  "BATTLE_VIABILITY_EVALUATION_FAILED",
] as const;

describe("AC-13: battle-resolution reason-code set-equality", () => {
  it("every DESIGN-38 §36 code is already shipped by the shared + generation catalogs (nothing silently missing)", () => {
    const shared = new Set<string>([
      ...Object.values(REASON_CODES),
      ...Object.values(GENERATION_REASON_CODES),
    ]);
    for (const code of DESIGN_38_SECTION_36_CODES) {
      expect(shared.has(code)).toBe(true);
    }
  });

  it("the battle-resolution module ships exactly its two in-slice markers — nothing more, nothing less", () => {
    const shipped = Object.values(BATTLE_RESOLUTION_REASON_CODES).sort();
    expect(shipped).toEqual([...IN_SLICE_MARKERS].sort());
  });

  it("reused auto-resolution codes are defined once in the shared/generation catalogs, not redefined here", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(BATTLE_RESOLUTION_REASON_CODES));
    const shared: ReadonlySet<string> = new Set(Object.values(REASON_CODES));
    const generation: ReadonlySet<string> = new Set(Object.values(GENERATION_REASON_CODES));
    for (const reuse of [...REUSED_AUTO_RESOLUTION_CODES, ...REUSED_COMBAT_CATALOG_CODES]) {
      expect(shipped.has(reuse)).toBe(false);
      expect(shared.has(reuse) || generation.has(reuse)).toBe(true);
    }
  });

  it("the module catalog and the shared/generation catalogs are disjoint (no duplicate code)", () => {
    const moduleSet: ReadonlySet<string> = new Set(Object.values(BATTLE_RESOLUTION_REASON_CODES));
    const other: Set<string> = new Set([
      ...Object.values(REASON_CODES),
      ...Object.values(GENERATION_REASON_CODES),
    ]);
    for (const code of moduleSet) {
      expect(other.has(code)).toBe(false);
    }
  });
});
