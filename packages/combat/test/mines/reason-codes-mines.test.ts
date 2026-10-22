import { describe, expect, it } from "vite-plus/test";
import { REASON_CODES } from "@bluewave/combat/core";
import {
  CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING,
  DUAL_EQUIPMENT_MODE_MISSING,
  INVALID_MINE_PRESSURE_STATE,
  INVALID_MINE_TYPE_DEFINITION,
  MINE_DECAY_POLICY_MISSING,
  MINE_DEFENSIVE_STANDOFF_ACTIVE,
  MINE_INVENTORY_INSUFFICIENT,
  MINE_LAYING_SOURCE_INELIGIBLE,
  MINE_PRESSURE_REDUCED,
  MINE_REASON_CODES,
  MINE_REPORT_CAUSE_UNCERTAIN,
  MINE_ROUTE_RISK_CREATED,
  MINE_STRIKE_RESOLUTION_DEFERRED,
  MINE_WARFARE_INVARIANT_FAILED,
  MINEFIELD_CLEARED,
  MINESWEEPING_SHIP_INELIGIBLE,
  MINE_SWEEP_RESISTANCE_MISSING,
} from "@bluewave/combat/mines";

const DESIGN_30_CODES: readonly string[] = [
  "INVALID_MINE_TYPE_DEFINITION",
  "INVALID_MINE_PRESSURE_STATE",
  "MINE_LAYING_SOURCE_INELIGIBLE",
  "MINE_INVENTORY_INSUFFICIENT",
  "MINESWEEPING_SHIP_INELIGIBLE",
  "DUAL_EQUIPMENT_MODE_MISSING",
  "MINE_SWEEP_RESISTANCE_MISSING",
  "MINE_PRESSURE_REDUCED",
  "MINE_BATTLE_HAZARD_GENERATED",
  "MINE_ROUTE_RISK_CREATED",
  "MINE_STRIKE_OCCURRED",
  "MINE_DEFENSIVE_STANDOFF_ACTIVE",
  "MINE_REPORT_CAUSE_UNCERTAIN",
  "MINE_DECAY_POLICY_MISSING",
  "CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING",
  "FRIENDLY_MINE_STRIKE_OCCURRED",
  "MINEFIELD_CLEARED",
  "MINE_WARFARE_INVARIANT_FAILED",
];

const SHIPPED_16: readonly string[] = [
  "CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING",
  "DUAL_EQUIPMENT_MODE_MISSING",
  "INVALID_MINE_PRESSURE_STATE",
  "INVALID_MINE_TYPE_DEFINITION",
  "MINE_DECAY_POLICY_MISSING",
  "MINE_DEFENSIVE_STANDOFF_ACTIVE",
  "MINE_INVENTORY_INSUFFICIENT",
  "MINE_LAYING_SOURCE_INELIGIBLE",
  "MINE_PRESSURE_REDUCED",
  "MINE_REPORT_CAUSE_UNCERTAIN",
  "MINE_ROUTE_RISK_CREATED",
  "MINE_STRIKE_RESOLUTION_DEFERRED",
  "MINE_SWEEP_RESISTANCE_MISSING",
  "MINE_WARFARE_INVARIANT_FAILED",
  "MINEFIELD_CLEARED",
  "MINESWEEPING_SHIP_INELIGIBLE",
].sort();

describe("AC-21: mine reason-code catalog set-equality (INC-8 partition vs DESIGN-35 §30)", () => {
  it("ships EXACTLY 16 codes (14 §30 + MINE_STRIKE_RESOLUTION_DEFERRED marker + MINE_WARFARE_INVARIANT_FAILED)", () => {
    const shipped = Object.values(MINE_REASON_CODES).sort();
    expect(shipped).toEqual(SHIPPED_16);
    expect(shipped.length).toBe(16);
  });

  it("partition vs §30: the three strike/battle/friendly-fire codes are deferred, nothing else", () => {
    const shipped: ReadonlySet<string> = new Set(Object.values(MINE_REASON_CODES));
    const unshippedSection30 = DESIGN_30_CODES.filter((c) => !shipped.has(c)).sort();
    expect(unshippedSection30).toEqual([
      "FRIENDLY_MINE_STRIKE_OCCURRED",
      "MINE_BATTLE_HAZARD_GENERATED",
      "MINE_STRIKE_OCCURRED",
    ]);
    const shippedSection30 = DESIGN_30_CODES.filter((c) => shipped.has(c));
    expect(shippedSection30.length).toBe(15);
    const nonSection30 = [...shipped].filter((c) => !DESIGN_30_CODES.includes(c));
    expect(nonSection30).toEqual([MINE_STRIKE_RESOLUTION_DEFERRED]);
  });

  it("is disjoint from the top-level combat catalog (no redefinition)", () => {
    const mineSet = new Set(Object.values(MINE_REASON_CODES) as readonly string[]);
    const sharedSet: ReadonlySet<string> = new Set(Object.values(REASON_CODES));
    for (const code of mineSet) {
      expect(sharedSet.has(code)).toBe(false);
    }
  });

  it("ships each prior-increment code under its exported literal name", () => {
    expect(INVALID_MINE_TYPE_DEFINITION).toBe("INVALID_MINE_TYPE_DEFINITION");
    expect(INVALID_MINE_PRESSURE_STATE).toBe("INVALID_MINE_PRESSURE_STATE");
    expect(MINE_LAYING_SOURCE_INELIGIBLE).toBe("MINE_LAYING_SOURCE_INELIGIBLE");
    expect(MINE_INVENTORY_INSUFFICIENT).toBe("MINE_INVENTORY_INSUFFICIENT");
    expect(MINESWEEPING_SHIP_INELIGIBLE).toBe("MINESWEEPING_SHIP_INELIGIBLE");
    expect(DUAL_EQUIPMENT_MODE_MISSING).toBe("DUAL_EQUIPMENT_MODE_MISSING");
    expect(MINE_SWEEP_RESISTANCE_MISSING).toBe("MINE_SWEEP_RESISTANCE_MISSING");
    expect(MINE_PRESSURE_REDUCED).toBe("MINE_PRESSURE_REDUCED");
    expect(MINE_DEFENSIVE_STANDOFF_ACTIVE).toBe("MINE_DEFENSIVE_STANDOFF_ACTIVE");
    expect(MINE_ROUTE_RISK_CREATED).toBe("MINE_ROUTE_RISK_CREATED");
    expect(MINE_STRIKE_RESOLUTION_DEFERRED).toBe("MINE_STRIKE_RESOLUTION_DEFERRED");
    expect(MINE_REPORT_CAUSE_UNCERTAIN).toBe("MINE_REPORT_CAUSE_UNCERTAIN");
    expect(MINE_DECAY_POLICY_MISSING).toBe("MINE_DECAY_POLICY_MISSING");
    expect(CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING).toBe(
      "CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING",
    );
    expect(MINEFIELD_CLEARED).toBe("MINEFIELD_CLEARED");
    expect(MINE_WARFARE_INVARIANT_FAILED).toBe("MINE_WARFARE_INVARIANT_FAILED");
  });

  it("every shipped code is a distinct non-empty literal", () => {
    const values = Object.values(MINE_REASON_CODES) as readonly string[];
    expect(new Set(values).size).toBe(values.length);
    for (const code of values) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });
});
