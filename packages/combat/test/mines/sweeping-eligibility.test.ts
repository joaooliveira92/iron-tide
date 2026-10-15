// AC-6 (INC-3): DESIGN-35 §6 minesweeping eligibility — every §6 predicate is
// enforced; each failure axis reports the stable reason + the failing
// predicate through a structured verdict (never a throw); an ineligible ship
// contributes ZERO sweeping value. Mirrors the launch-eligibility verdict
// pattern (torpedo module) as shape reference only — no import from torpedoes.
import { describe, expect, it } from "vite-plus/test";
import {
  INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION,
  minesweepingShipEligible,
  MINESWEEPING_INELIGIBILITY_REASONS,
  type MinesweepingEligibilityPredicate,
  type MinesweepingShip,
  type MinesweepingShipType,
} from "../../src/mines/index.js";

function eligibleShip(overrides: Partial<MinesweepingShip> = {}): MinesweepingShip {
  return {
    shipId: "hms-victoria-001",
    shipType: "DEDICATED_FLEET_MINESWEEPER",
    sweepEquipmentInstalled: true,
    sweepEquipmentOperational: true,
    sweepEquipmentCompatibleWithMineType: true,
    mission: "MINE_WARFARE",
    sweepingAuthorization: true,
    readiness: "ACTIVE",
    damage: "OPERATIONAL",
    locatedInSweptAreaOrConnectedApproach: true,
    fuelSufficient: true,
    supplySufficient: true,
    crewSufficient: true,
    ammunitionOrSweepInventorySufficient: true,
    unavailableFlags: [],
    validatedSweepingCommandOrPlanActive: true,
    ...overrides,
  };
}

function expectIneligible(
  ship: MinesweepingShip,
  predicate: MinesweepingEligibilityPredicate,
): void {
  let threw = false;
  let result: ReturnType<typeof minesweepingShipEligible> | undefined;
  try {
    result = minesweepingShipEligible(ship);
  } catch {
    threw = true;
  }
  expect(threw).toBe(false); // NEVER throws on ineligibility
  expect(result).toBeDefined();
  if (result!.eligible) {
    throw new Error(`expected ineligible (predicate: ${predicate})`);
  }
  expect(result!.reason).toBe(MINESWEEPING_INELIGIBILITY_REASONS[predicate]);
  expect(result!.verdict.failingPredicate).toBe(predicate);
  // contributor-of-zero semantics: the false branch carries no ship (there is
  // no contributor to aggregate) — nothing downstream can sum a value for it.
  expect("ship" in result!).toBe(false);
  expect(INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION).toBe(0);
}

describe("AC-6: an eligible ship passes all §6 predicates", () => {
  it("passes every predicate and returns the ship", () => {
    const ship = eligibleShip();
    const result = minesweepingShipEligible(ship);
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.ship).toBe(ship);
      expect(result.verdict.failingPredicate).toBeNull();
      const results = result.verdict.predicateResults;
      for (const name of Object.keys(results) as MinesweepingEligibilityPredicate[]) {
        expect(results[name]).toBe(true);
      }
    }
  });

  it("accepts DD/KE/CL/AMC/converted-TR/coastal/dedicated types", () => {
    const types: MinesweepingShipType[] = [
      "DEDICATED_FLEET_MINESWEEPER",
      "DEDICATED_COASTAL_MINESWEEPER",
      "DD_WITH_MINE_SWEEPING_EQUIPMENT",
      "KE_WITH_MINE_SWEEPING_EQUIPMENT",
      "CL_WITH_MINE_SWEEPING_EQUIPMENT",
      "AMC_WITH_MINE_SWEEPING_EQUIPMENT",
      "CONVERTED_TR_MINESWEEPER",
      "OTHER_EXPLICITLY_ELIGIBLE",
    ];
    for (const shipType of types) {
      expect(minesweepingShipEligible(eligibleShip({ shipType })).eligible).toBe(true);
    }
  });

  it("MINE_WARFARE needs no sweeping authorization; TRADE_PROTECTION does", () => {
    expect(
      minesweepingShipEligible(
        eligibleShip({ mission: "MINE_WARFARE", sweepingAuthorization: false }),
      ).eligible,
    ).toBe(true);
    expect(
      minesweepingShipEligible(
        eligibleShip({ mission: "TRADE_PROTECTION", sweepingAuthorization: true }),
      ).eligible,
    ).toBe(true);
    const none = minesweepingShipEligible(
      eligibleShip({ mission: "TRADE_PROTECTION", sweepingAuthorization: false }),
    );
    expect(none.eligible).toBe(false);
    expect(none.verdict.failingPredicate).toBe("missionAndSweepingAuthorization");
  });
});

describe("AC-6: every ineligibility axis is enforced with its stable reason", () => {
  it("bad ship type (not in the eligible set)", () => {
    const ship = eligibleShip({ shipType: "BATTLESHIP" as unknown as MinesweepingShipType });
    expectIneligible(ship, "shipTypeEligible");
  });

  it("equipment not installed / not operational", () => {
    expectIneligible(eligibleShip({ sweepEquipmentInstalled: false }), "equipmentInstalled");
    expectIneligible(eligibleShip({ sweepEquipmentOperational: false }), "equipmentOperational");
  });

  it("equipment incompatible or of unknown compatibility", () => {
    expectIneligible(
      eligibleShip({ sweepEquipmentCompatibleWithMineType: false }),
      "equipmentCompatible",
    );
    expectIneligible(
      eligibleShip({ sweepEquipmentCompatibleWithMineType: "unknown" }),
      "equipmentCompatible",
    );
  });

  it("wrong mission (not MINE_WARFARE/TRADE_PROTECTION)", () => {
    expectIneligible(
      eligibleShip({ mission: "PATROL" as unknown as MinesweepingShip["mission"] }),
      "missionAndSweepingAuthorization",
    );
  });

  it("missing TRADE_PROTECTION sweeping authorization", () => {
    expectIneligible(
      eligibleShip({ mission: "TRADE_PROTECTION", sweepingAuthorization: false }),
      "missionAndSweepingAuthorization",
    );
  });

  it("readiness not ACTIVE", () => {
    for (const readiness of ["MOBILIZING", "WORKING_UP", "IN_RESERVE"] as const) {
      expectIneligible(eligibleShip({ readiness }), "readinessActive");
    }
  });

  it("damage below OPERATIONAL/DEGRADED", () => {
    expectIneligible(eligibleShip({ damage: "INOPERATIVE" }), "damageOperationalOrDegraded");
  });

  it("wrong location (outside swept area and connected approaches)", () => {
    expectIneligible(
      eligibleShip({ locatedInSweptAreaOrConnectedApproach: false }),
      "locatedInSweptAreaOrConnectedApproach",
    );
  });

  it("any fuel/supply/crew/ammunition-or-sweep-inventory shortage", () => {
    expectIneligible(eligibleShip({ fuelSufficient: false }), "fuelSupplyCrewAmmunitionSufficient");
    expectIneligible(
      eligibleShip({ supplySufficient: false }),
      "fuelSupplyCrewAmmunitionSufficient",
    );
    expectIneligible(eligibleShip({ crewSufficient: false }), "fuelSupplyCrewAmmunitionSufficient");
    expectIneligible(
      eligibleShip({ ammunitionOrSweepInventorySufficient: false }),
      "fuelSupplyCrewAmmunitionSufficient",
    );
  });

  it("interned / captured / major-dockyard unavailable flags", () => {
    expectIneligible(eligibleShip({ unavailableFlags: ["INTERNED"] }), "notUnavailable");
    expectIneligible(eligibleShip({ unavailableFlags: ["CAPTURED"] }), "notUnavailable");
    expectIneligible(eligibleShip({ unavailableFlags: ["MAJOR_DOCKYARD"] }), "notUnavailable");
    expectIneligible(
      eligibleShip({ unavailableFlags: ["INTERNED", "MAJOR_DOCKYARD"] }),
      "notUnavailable",
    );
  });

  it("no validated sweeping command/plan active", () => {
    expectIneligible(
      eligibleShip({ validatedSweepingCommandOrPlanActive: false }),
      "validatedSweepingCommandOrPlanActive",
    );
  });

  it("first failing predicate wins (deterministic ordering)", () => {
    const ship = eligibleShip({
      shipType: "BATTLESHIP" as unknown as MinesweepingShipType,
      sweepEquipmentInstalled: false,
    });
    expectIneligible(ship, "shipTypeEligible");
  });

  it("never throws across every axis (structured verdict only)", () => {
    const axes: Array<Partial<MinesweepingShip>> = [
      { shipType: "BATTLESHIP" as unknown as MinesweepingShipType },
      { sweepEquipmentInstalled: false },
      { sweepEquipmentOperational: false },
      { sweepEquipmentCompatibleWithMineType: "unknown" },
      { mission: "TRADE_PROTECTION", sweepingAuthorization: false },
      { readiness: "WORKING_UP" },
      { damage: "INOPERATIVE" },
      { locatedInSweptAreaOrConnectedApproach: false },
      { fuelSufficient: false },
      { unavailableFlags: ["CAPTURED"] },
      { validatedSweepingCommandOrPlanActive: false },
    ];
    for (const partial of axes) {
      expect(() => minesweepingShipEligible(eligibleShip(partial))).not.toThrow();
    }
  });
});
