import type { CampaignSnapshot, NationState, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

function makeShip(id: string, readiness: Ship["readiness"], crewQuality: number): Ship {
  return {
    id,
    name: id,
    classId: "battleship",
    nationId: "GBR",
    locationAreaId: "a-1",
    designVersionId: "",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness,
    crewQuality: SafeInt(crewQuality),
  };
}

function makeNation(ships: Ship[]): NationState {
  return {
    id: "GBR",
    name: "GBR",
    tag: "GBR",
    treasury: SafeInt(10000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: "fleet-GBR", nationId: "GBR", name: "GBR Fleet", locationAreaId: "a-1", ships }],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function makeSnapshot(
  nation: NationState,
  wars: CampaignSnapshot["wars"]["wars"] = [],
): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "readiness-evolution",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", nation]]),
    wars: {
      wars,
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

function runMonth(
  ships: Ship[],
  wars: CampaignSnapshot["wars"]["wars"] = [],
): ReturnType<MonthExecutor["execute"]> {
  return new MonthExecutor().execute(
    makeSnapshot(makeNation(ships), wars),
    [],
    "readiness-seed",
    new DiagnosticCollector(),
  );
}

describe("S-1 ticket 03: crew-quality ramp", () => {
  it("ramps crew toward each state's ceiling, promotes a working-up ship at the decent threshold, consumes no randomness", () => {
    const result = runMonth([
      makeShip("active", "ACTIVE", 100),
      makeShip("working-up", "WORKING_UP", 55),
      makeShip("reserve", "RESERVE", 50),
      makeShip("mothballed", "MOTHBALLED", 0),
    ]);

    expect(result.success).toBe(true);
    const ships = result.finalSnapshot.nations.get("GBR")!.fleets[0]!.ships;
    const byId = (id: string) => ships.find((s) => s.id === id)!;

    // An active ship at its ceiling does not move.
    expect(byId("active").crewQuality as number).toBe(100);
    expect(byId("active").readiness).toBe("ACTIVE");

    // A working-up ship reaches the decent threshold (60) and is promoted to active.
    expect(byId("working-up").crewQuality as number).toBe(60);
    expect(byId("working-up").readiness).toBe("ACTIVE");

    // Reserve ramps toward 70 (50 -> 55); mothballed toward 30 (0 -> 5).
    expect(byId("reserve").crewQuality as number).toBe(55);
    expect(byId("reserve").readiness).toBe("RESERVE");
    expect(byId("mothballed").crewQuality as number).toBe(5);
    expect(byId("mothballed").readiness).toBe("MOTHBALLED");

    // The readiness transition is a domain event with a stable reason code.
    const transition = result.eventLedger.all.find((e) => e.body.kind === "ShipReadinessChanged");
    expect(transition?.body.kind).toBe("ShipReadinessChanged");
    if (transition?.body.kind === "ShipReadinessChanged") {
      expect(transition.body.shipId).toBe("working-up");
      expect(transition.body.fromReadiness).toBe("WORKING_UP");
      expect(transition.body.toReadiness).toBe("ACTIVE");
      expect(transition.body.reason).toBe("WORKING_UP_COMPLETE");
    }
  });

  it("never returns a promoted ship to working up and never leaves 0..100", () => {
    const result = runMonth([makeShip("promoted", "WORKING_UP", 59)]);
    const ship = result.finalSnapshot.nations.get("GBR")!.fleets[0]!.ships[0]!;
    expect(ship.readiness).toBe("ACTIVE");
    expect(ship.crewQuality as number).toBe(64);
    expect(ship.crewQuality as number).toBeGreaterThanOrEqual(0);
    expect(ship.crewQuality as number).toBeLessThanOrEqual(100);
  });

  it("is a strict no-op for an all-active fleet at its ceiling (hash-neutral)", () => {
    const result = runMonth([makeShip("a", "ACTIVE", 100), makeShip("b", "ACTIVE", 100)]);
    expect(result.eventLedger.all.some((e) => e.body.kind === "ShipReadinessChanged")).toBe(false);
  });
});

describe("S-1 ticket 04: repair state", () => {
  it("counts down a repairing ship, charges it at 2x active, then releases it without losing crew", () => {
    const repair: Ship = { ...makeShip("repair", "REPAIR", 50), repairMonthsRemaining: SafeInt(2) };
    const snapshot = makeSnapshot(makeNation([repair]));

    // Month 1: REPAIR charges 2x active (floor(100*10/100) * 2 = 20); counter 1.
    const m1 = new MonthExecutor().execute(snapshot, [], "repair-seed", new DiagnosticCollector());
    let ship = m1.finalSnapshot.nations.get("GBR")!.fleets[0]!.ships[0]!;
    expect(m1.finalSnapshot.nations.get("GBR")!.maintenanceCost as number).toBe(20);
    expect(ship.readiness).toBe("REPAIR");
    expect(ship.repairMonthsRemaining as number).toBe(1);
    expect(ship.crewQuality as number).toBe(50);

    // Month 2: the counter reaches zero and the ship is released to active, crew held.
    const m2 = new MonthExecutor().execute(
      m1.finalSnapshot,
      [],
      "repair-seed",
      new DiagnosticCollector(),
    );
    ship = m2.finalSnapshot.nations.get("GBR")!.fleets[0]!.ships[0]!;
    expect(ship.readiness).toBe("ACTIVE");
    expect(ship.repairMonthsRemaining).toBeUndefined();
    expect(ship.crewQuality as number).toBe(50);
    const released = m2.eventLedger.all.find((e) => e.body.kind === "ShipReadinessChanged");
    if (released?.body.kind === "ShipReadinessChanged") {
      expect(released.body.reason).toBe("REPAIR_COMPLETE");
      expect(released.body.fromReadiness).toBe("REPAIR");
      expect(released.body.toReadiness).toBe("ACTIVE");
    } else {
      throw new Error("expected a ShipReadinessChanged event");
    }
  });

  it("halts the countdown and drops the premium while mothballed", () => {
    const mothballed: Ship = {
      ...makeShip("mb", "MOTHBALLED", 50),
      repairMonthsRemaining: SafeInt(3),
    };
    const result = runMonth([mothballed]);
    const ship = result.finalSnapshot.nations.get("GBR")!.fleets[0]!.ships[0]!;
    // Mothballed charges half active (5), not the repair 2x premium.
    expect(result.finalSnapshot.nations.get("GBR")!.maintenanceCost as number).toBe(5);
    // The countdown is halted, not advanced.
    expect(ship.repairMonthsRemaining as number).toBe(3);
    expect(ship.readiness).toBe("MOTHBALLED");
  });
});

describe("S-1 ticket 05: wartime maintenance", () => {
  const war: CampaignSnapshot["wars"]["wars"] = [
    {
      id: "war_1",
      attackerSideId: "side_a",
      defenderSideId: "side_d",
      attackerSideMembers: ["GBR"],
      defenderSideMembers: ["FRA"],
      attackerWarScore: 0,
      defenderWarScore: 0,
      attackerId: "GBR",
      defenderId: "FRA",
      startDate: "1880-01",
      status: "ACTIVE",
    },
  ];

  it("raises active maintenance by the ruleset multiplier in war and leaves other states unchanged", () => {
    const ships = [makeShip("active", "ACTIVE", 100), makeShip("reserve", "RESERVE", 100)];

    const peace = runMonth(ships);
    const wartime = runMonth(ships, war);

    // Peace: ACTIVE 10 + RESERVE floor(7.5) = 7 => 17.
    expect(peace.finalSnapshot.nations.get("GBR")!.maintenanceCost as number).toBe(17);
    // War: ACTIVE 10 * 1.25 = 12 (floor) + RESERVE 7 (unchanged) => 19.
    expect(wartime.finalSnapshot.nations.get("GBR")!.maintenanceCost as number).toBe(19);

    const peaceEntry = peace.financialLedger.all.find(
      (e) => e.categoryId === "MAINTENANCE_EXPENDITURE",
    );
    const warEntry = wartime.financialLedger.all.find(
      (e) => e.categoryId === "MAINTENANCE_EXPENDITURE",
    );
    expect(peaceEntry!.debit as number).toBe(17);
    expect(warEntry!.debit as number).toBe(19);
  });

  it("a war that does not name the nation leaves its maintenance unchanged", () => {
    const otherWar: CampaignSnapshot["wars"]["wars"] = [
      { ...war[0]!, attackerSideMembers: ["FRA"], defenderSideMembers: ["RUS"] },
    ];
    const ships = [makeShip("active", "ACTIVE", 100)];
    const peace = runMonth(ships);
    const unrelated = runMonth(ships, otherWar);
    expect(unrelated.finalSnapshot.nations.get("GBR")!.maintenanceCost as number).toBe(
      peace.finalSnapshot.nations.get("GBR")!.maintenanceCost as number,
    );
  });
});
