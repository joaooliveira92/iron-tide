import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  baseLimitInArea,
  measureBaseLimits,
  type BaseLimitRules,
  type CampaignSnapshot,
  type NationState,
  type Ship,
} from "../src/index.js";
import type { PortData } from "../src/state.js";

const RULES: BaseLimitRules = {
  limitByBaseLevel: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => n * 2),
  noBaseLimit: 1,
  occupyingStates: ["ACTIVE", "RESERVE"],
  maintenanceAdderBp: 2_500,
  crewQualityReduction: 15,
};

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "c",
    nationId: "uk",
    locationAreaId: "india",
    designVersionId: "d",
    hitPoints: SafeInt(10),
    maxHitPoints: SafeInt(10),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function nation(id: string, ships: Ship[]): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets: [{ id: `f-${id}`, nationId: id, name: id, locationAreaId: "india", ships }],
    divisions: [],
    research: {
      nationId: id,
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

const port = (id: string, nationId: string, areaId: string, level: number): PortData => ({
  id,
  name: id,
  areaId,
  nationId,
  level: SafeInt(level),
});

function snapshot(
  ships: Ship[],
  ports: PortData[] = [port("p1", "uk", "india", 2)],
): Pick<CampaignSnapshot, "nations" | "world"> {
  return {
    nations: new Map([["uk", nation("uk", ships)]]),
    world: { areas: [], routes: [], ports, possessions: [] },
  };
}

describe("baseLimitInArea", () => {
  it("maps the nation's best port level in the area through the table", () => {
    const ports = [port("a", "uk", "india", 2), port("b", "uk", "india", 5)];
    expect(baseLimitInArea({ ports }, "uk", "india", RULES)).toBe(10);
  });

  it("uses the no-base limit where the nation has no port in the area", () => {
    const ports = [port("a", "fr", "india", 9), port("b", "uk", "cape", 9)];
    expect(baseLimitInArea({ ports }, "uk", "india", RULES)).toBe(1);
  });

  it("treats a port level outside the table as no base value", () => {
    expect(baseLimitInArea({ ports: [port("a", "uk", "india", 11)] }, "uk", "india", RULES)).toBe(
      1,
    );
  });
});

describe("measureBaseLimits", () => {
  it("flags the ships beyond the limit by ascending ship id and none within it", () => {
    const ships = ["s1", "s2", "s3", "s4", "s5"].map((id) => ship(id));
    const [row] = measureBaseLimits(snapshot(ships.reverse()), RULES);
    expect(row).toEqual({
      nationId: "uk",
      areaId: "india",
      deployed: 5,
      limit: 4,
      overShipIds: ["s5"],
    });
  });

  it("only counts ships in an occupying state that are commissioned and operational", () => {
    const ships = [
      ship("a"),
      ship("b", { readiness: "RESERVE" }),
      ship("c", { readiness: "MOTHBALLED" }),
      ship("d", { readiness: "REPAIR" }),
      ship("e", { isUnderConstruction: true }),
      ship("f", { availability: "UNAVAILABLE" }),
    ];
    const [row] = measureBaseLimits(snapshot(ships), RULES);
    expect(row?.deployed).toBe(2);
  });

  it("applies the no-base limit in an area without a nation port, and orders rows by nation then area", () => {
    const ships = [
      ship("x1", { locationAreaId: "cape" }),
      ship("x2", { locationAreaId: "cape" }),
      ship("y1", { locationAreaId: "africa" }),
    ];
    const rows = measureBaseLimits(snapshot(ships), RULES);
    expect(rows.map((r) => [r.areaId, r.deployed, r.limit, r.overShipIds])).toEqual([
      ["africa", 1, 1, []],
      ["cape", 2, 1, ["x2"]],
    ]);
  });

  it("is independent of the order in which ships are stored", () => {
    const ships = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => ship(id));
    expect(measureBaseLimits(snapshot(ships), RULES)).toEqual(
      measureBaseLimits(snapshot([...ships].reverse()), RULES),
    );
  });

  it("is not exempted by a war or blockade (ADR-0248): it reads neither", () => {
    expect(() => measureBaseLimits(snapshot([ship("a")]), RULES)).not.toThrow();
  });
});
