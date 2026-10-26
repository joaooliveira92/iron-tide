import { SafeInt } from "@bluewave/contracts";
import type { ShipReadinessState } from "../src/readiness.js";
import { describe, expect, it } from "vite-plus/test";
import {
  MAINTENANCE_ACTIVE_MULTIPLIER_BP,
  MAINTENANCE_FORMULA_ID,
  MAINTENANCE_FORMULA_VERSION,
  MAINTENANCE_MOTHBALLED_MULTIPLIER_BP,
  MAINTENANCE_REPAIR_MULTIPLIER_BP,
  MAINTENANCE_RESERVE_MULTIPLIER_BP,
  MAINTENANCE_WORKING_UP_MULTIPLIER_BP,
  fleetMaintenanceBreakdown,
  maintenanceMultiplierBp,
  nationIsAtWar,
  nationMonthlyMaintenance,
  shipMaintenanceCost,
  shipMonthlyMaintenanceCost,
} from "../src/maintenance.js";

describe("S-1 maintenance formula (ticket 02)", () => {
  it("charges the base rate for an active ship", () => {
    expect(shipMaintenanceCost(SafeInt(100), "ACTIVE")).toBe(10);
  });

  it("scales the base rate by the state multiplier, floor-rounded", () => {
    expect(shipMaintenanceCost(SafeInt(100), "RESERVE")).toBe(7);
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

describe("S-1 wartime maintenance (ticket 05)", () => {
  it("applies the multiplier to active ships at war and nothing otherwise", () => {
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", false)).toBe(10);
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", true)).toBe(12);
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
    expect(nationIsAtWar(wars, "spain")).toBe(false);
    expect(nationIsAtWar(wars, "italy")).toBe(false);
  });
});

describe("S-5 08 over-base maintenance adder (ticket 82)", () => {
  it("adds the ruleset basis points on top of the state and wartime cost, floor-rounded", () => {
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", false, SafeInt(2_500))).toBe(12);
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", true, SafeInt(2_500))).toBe(15);
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", false, SafeInt(0))).toBe(10);
  });

  it("leaves the cost unchanged without an adder", () => {
    expect(shipMonthlyMaintenanceCost(SafeInt(100), "ACTIVE", false)).toBe(10);
  });

  it("charges a flagged ship's adder in the nation total and nothing for unflagged ships", () => {
    const fleet = {
      ships: [
        { hitPoints: SafeInt(100), readiness: "ACTIVE" as const },
        {
          hitPoints: SafeInt(100),
          readiness: "ACTIVE" as const,
          overBase: { maintenanceAdderBp: SafeInt(5_000) },
        },
      ],
    };
    expect(nationMonthlyMaintenance([fleet], false)).toBe(10 + 15);
  });
});

describe("fleetMaintenanceBreakdown", () => {
  const fleet = (
    ships: readonly { id: string; hitPoints: number; readiness: ShipReadinessState }[],
  ) => [
    {
      ships: ships.map((s) => ({
        id: s.id,
        name: `HMS ${s.id}`,
        hitPoints: SafeInt(s.hitPoints),
        readiness: s.readiness,
      })),
    },
  ];

  it("groups cost by readiness and reconciles to the nation total", () => {
    const fleets = fleet([
      { id: "a", hitPoints: 100, readiness: "ACTIVE" },
      { id: "b", hitPoints: 200, readiness: "ACTIVE" },
      { id: "c", hitPoints: 100, readiness: "RESERVE" },
      { id: "d", hitPoints: 100, readiness: "MOTHBALLED" },
    ]);
    const breakdown = fleetMaintenanceBreakdown(fleets, false);
    expect(breakdown.total).toBe(Number(nationMonthlyMaintenance(fleets, false)));
    expect(breakdown.groups.map((g) => [g.readiness, g.ships, g.cost, g.multiplierBp])).toEqual([
      ["ACTIVE", 2, 30, 10_000],
      ["WORKING_UP", 0, 0, 10_000],
      ["RESERVE", 1, 7, 7_500],
      ["MOTHBALLED", 1, 5, 5_000],
      ["REPAIR", 0, 0, 20_000],
    ]);
    expect(breakdown.warSurcharge).toBe(0);
  });

  it("lists ships by cost, dearest first, and reports the wartime surcharge on active ships", () => {
    const fleets = fleet([
      { id: "a", hitPoints: 100, readiness: "ACTIVE" },
      { id: "b", hitPoints: 400, readiness: "ACTIVE" },
      { id: "c", hitPoints: 100, readiness: "RESERVE" },
    ]);
    const peace = fleetMaintenanceBreakdown(fleets, false);
    const war = fleetMaintenanceBreakdown(fleets, true);
    expect(war.ships.map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(war.total).toBe(Number(nationMonthlyMaintenance(fleets, true)));
    expect(war.warSurcharge).toBe(war.total - peace.total);
    expect(war.warSurcharge).toBeGreaterThan(0);
  });
});
