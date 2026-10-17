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

function makeSnapshot(nation: NationState): CampaignSnapshot {
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
      wars: [],
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

function runMonth(ships: Ship[]): ReturnType<MonthExecutor["execute"]> {
  return new MonthExecutor().execute(
    makeSnapshot(makeNation(ships)),
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
