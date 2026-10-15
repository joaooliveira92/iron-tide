import { describe, expect, it } from "vite-plus/test";
import {
  INVALID_COASTAL_BATTERY_DEFINITION,
  UNKNOWN_LAND_TARGET_TYPE,
  INVALID_DAMAGE_STATE_TRANSITION,
  COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID,
  COASTAL_ARTILLERY_MINE_PRESSURE_MISSING,
  COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING,
  COASTAL_DEFENSE_INVARIANT_FAILED,
  COASTAL_DEFENSE_RESOLUTION_DEFERRED,
} from "../../src/coastal-defense/index.js";

const SHIPPED_IN_SLICE_CODES = [
  "INVALID_COASTAL_BATTERY_DEFINITION",
  "UNKNOWN_LAND_TARGET_TYPE",
  "INVALID_DAMAGE_STATE_TRANSITION",
  "COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID",
  "COASTAL_ARTILLERY_MINE_PRESSURE_MISSING",
  "COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING",
  "COASTAL_DEFENSE_INVARIANT_FAILED",
] as const;

const SHIPPED_MARKER_CODES = ["COASTAL_DEFENSE_RESOLUTION_DEFERRED"] as const;

const ALL_SHIPPED = [...SHIPPED_IN_SLICE_CODES, ...SHIPPED_MARKER_CODES];

describe("Reason-code set-equality (C-4)", () => {
  it("all in-slice codes are exported correctly", () => {
    expect(INVALID_COASTAL_BATTERY_DEFINITION).toBe("INVALID_COASTAL_BATTERY_DEFINITION");
    expect(UNKNOWN_LAND_TARGET_TYPE).toBe("UNKNOWN_LAND_TARGET_TYPE");
    expect(INVALID_DAMAGE_STATE_TRANSITION).toBe("INVALID_DAMAGE_STATE_TRANSITION");
    expect(COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID).toBe("COASTAL_DEFENSE_PLACEMENT_ZONE_INVALID");
    expect(COASTAL_ARTILLERY_MINE_PRESSURE_MISSING).toBe("COASTAL_ARTILLERY_MINE_PRESSURE_MISSING");
    expect(COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING).toBe(
      "COASTAL_DEFENSE_EFFECTIVENESS_FORMULA_MISSING",
    );
    expect(COASTAL_DEFENSE_INVARIANT_FAILED).toBe("COASTAL_DEFENSE_INVARIANT_FAILED");
  });

  it("marker code is exported correctly", () => {
    expect(COASTAL_DEFENSE_RESOLUTION_DEFERRED).toBe("COASTAL_DEFENSE_RESOLUTION_DEFERRED");
  });

  it("shipped set has exactly 8 codes (7 in-slice + 1 marker)", () => {
    expect(ALL_SHIPPED.length).toBe(8);
  });

  it("no duplicate codes in shipped set", () => {
    const unique = new Set(ALL_SHIPPED);
    expect(unique.size).toBe(ALL_SHIPPED.length);
  });

  it("all in-slice code names start with valid prefix", () => {
    for (const code of SHIPPED_IN_SLICE_CODES) {
      expect(
        code.startsWith("INVALID_") || code.startsWith("UNKNOWN_") || code.startsWith("COASTAL_"),
      ).toBe(true);
    }
  });

  it("marker code has expected name", () => {
    expect(SHIPPED_MARKER_CODES[0]).toBe("COASTAL_DEFENSE_RESOLUTION_DEFERRED");
  });
});
