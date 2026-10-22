import { describe, expect, it } from "vite-plus/test";
import { BATTLE_RESOLUTION_REASON_CODES } from "@bluewave/combat/battleResolution";
import { REASON_CODES } from "@bluewave/combat/core";
import { GENERATION_REASON_CODES } from "@bluewave/combat/generation";

const DESIGN_38_SECTION_36_CODES = [
  "INVALID_TACTICAL_TIME_CONTRACT",
  "INVALID_TACTICAL_CLOCK",
  "TACTICAL_FOG_OF_WAR_VIOLATION",
  "AUTO_RESOLUTION_UNAVAILABLE",
  "AUTO_RESOLUTION_VALIDATION_FAILED",
  "TACTICAL_STATE_INVARIANT_FAILED",
] as const;

const REUSED_AUTO_RESOLUTION_CODES = [
  "AUTO_RESOLUTION_UNAVAILABLE",
  "AUTO_RESOLUTION_VALIDATION_FAILED",
] as const;

const REUSED_COMBAT_CATALOG_CODES = ["TACTICAL_STATE_INVARIANT_FAILED"] as const;

const IN_SLICE_MARKERS = [
  "BATTLE_AUTO_RESOLUTION_FAILED",
  "BATTLE_VIABILITY_EVALUATION_FAILED",
] as const;

describe("AC-13: battle-resolution reason-code set-equality", () => {
  it("every surviving DESIGN-38 §36 code is shipped by the shared + generation catalogs", () => {
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
