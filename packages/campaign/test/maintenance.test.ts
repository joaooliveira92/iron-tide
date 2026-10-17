import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  MAINTENANCE_ACTIVE_MULTIPLIER_BP,
  MAINTENANCE_FORMULA_ID,
  MAINTENANCE_FORMULA_VERSION,
  MAINTENANCE_MOTHBALLED_MULTIPLIER_BP,
  MAINTENANCE_REPAIR_MULTIPLIER_BP,
  MAINTENANCE_RESERVE_MULTIPLIER_BP,
  MAINTENANCE_WORKING_UP_MULTIPLIER_BP,
  maintenanceMultiplierBp,
  nationIsAtWar,
  shipMaintenanceCost,
  shipMonthlyMaintenanceCost,
} from "../src/maintenance.js";

// S-1 ticket 02: maintenance is charged by readiness state through one shared,
// versioned formula (ADR-0223, decision request 0007-A).
describe("S-1 maintenance formula (ticket 02)", () => {
  it("charges the base rate for an active ship", () => {
    expect(shipMaintenanceCost(SafeInt(100), "ACTIVE")).toBe(10);
  });

  it("scales the base rate by the state multiplier, floor-rounded", () => {
    expect(shipMaintenanceCost(SafeInt(100), "RESERVE")).toBe(7); // floor(10 * 7500 / 10000)
    expect(shipMaintenanceCost(SafeInt(100), "MOTHBALLED")).toBe(5);
    expect(shipMaintenanceCost(SafeInt(100), "WORKING_UP")).toBe(10);
  });

  it("charges repair about twice active (manual p.51)", () => {
    const active = shipMaintenanceCost(SafeInt(100), "ACTIVE");
    const repair = shipMaintenanceCost(SafeInt(100), "REPAIR");
    expect(repair).toBe(active * 2);
    expect(MAINTENANCE_REPAIR_MULTIPLIER_BP).toBe(MAINTENANCE_ACTIVE_MULTIPLIER_BP * 2);
  });

  it("mothballed is half active (manual p.30)", () => {
    expect(MAINTENANCE_MOTHBALLED_MULTIPLIER_BP * 2).toBe(MAINTENANCE_ACTIVE_MULTIPLIER_BP);
  });

  it("reserve is cheaper than active but above mothballed", () => {
    expect(MAINTENANCE_RESERVE_MULTIPLIER_BP).toBeLessThan(MAINTENANCE_ACTIVE_MULTIPLIER_BP);
    expect(MAINTENANCE_RESERVE_MULTIPLIER_BP).toBeGreaterThan(MAINTENANCE_MOTHBALLED_MULTIPLIER_BP);
  });

  it("working-up ships are in commission at the base rate", () => {
    expect(MAINTENANCE_WORKING_UP_MULTIPLIER_BP).toBe(MAINTENANCE_ACTIVE_MULTIPLIER_BP);
  });

  it("maps every readiness state to a positive multiplier", () => {
    for (const state of ["ACTIVE", "RESERVE", "MOTHBALLED", "WORKING_UP", "REPAIR"] as const) {
      expect(maintenanceMultiplierBp(state)).toBeGreaterThan(0);
    }
  });

  it("rejects a non-integer hull hit-point count at construction", () => {
    expect(() => SafeInt(10.5)).toThrow();
  });

  it("declares a stable formula id and version", () => {
    expect(MAINTENANCE_FORMULA_ID).toBe("maintenance_v2");
    expect(MAINTENANCE_FORMULA_VERSION).toBe("2.0.0");
  });
});

// S-1 ticket 05: the wartime maintenance multiplier.
describe("S-1 wartime maintenance (ticket 05)", () => {
  it("applies the multiplier to active ships at war and nothing otherwise", () => {
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", false)).toBe(10);
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", true)).toBe(12); // floor(10 * 12500 / 10000)
    // Only active status is raised.
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "RESERVE", true)).toBe(
      shipMonthlyMaintenanceCost(SafeInt(100), "RESERVE", false),
    );
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "MOTHBALLED", true)).toBe(
      shipMonthlyMaintenanceCost(SafeInt(100), "MOTHBALLED", false),
    );
  });

  it("reads only live wars that name the nation", () => {
    const wars = [
      { status: "ACTIVE", attackerSideMembers: ["uk"], defenderSideMembers: ["france"] },
      { status: "ENDED", attackerSideMembers: ["spain"], defenderSideMembers: ["uk"] },
    ];
    expect(nationIsAtWar(wars, "uk")).toBe(true);
    expect(nationIsAtWar(wars, "france")).toBe(true);
    expect(nationIsAtWar(wars, "spain")).toBe(false); // only in an ended war
    expect(nationIsAtWar(wars, "italy")).toBe(false);
  });
});
