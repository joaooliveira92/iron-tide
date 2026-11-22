import { SafeInt } from "@bluewave/contracts";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import {
  activeShipCount,
  completedShips,
  constructionProgressFromEvents,
  discoveriesFromEvents,
  fleetExerciseFromEvents,
  newlyActiveProjectIds,
  presenceFromEvents,
  researchProgressFromEvents,
  shipNameLookup,
  unrestFromEvents,
  type FleetSnapshot,
  type ProjectSnapshot,
} from "./reportEntry.js";

const ship = (id: string, isUnderConstruction: boolean) => ({
  id,
  name: `Name ${id}`,
  isUnderConstruction,
});

const fleetSnapshot = (ships: readonly ReturnType<typeof ship>[]): FleetSnapshot => ({
  fleets: [{ ships }],
});

const projectSnapshot = (
  projects: readonly { readonly id: string; readonly status: string }[],
): ProjectSnapshot => ({ constructionProjects: projects });

function envelope(body: DomainEventBody): DomainEventEnvelope {
  return {
    eventId: `evt-${body.kind}`,
    version: "1",
    aggregateType: "nation",
    aggregateId: "uk",
    eventType: body.kind,
    timestamp: "1880-01-01T00:00:00.000Z",
    body,
    sequenceNumber: SafeInt(1),
  };
}

describe("completedShips (pre→post fleet delta)", () => {
  it("counts a post-month active ship absent from the pre-month snapshot", () => {
    expect(
      completedShips(
        fleetSnapshot([ship("a", false)]),
        fleetSnapshot([ship("a", false), ship("b", false)]),
      ),
    ).toEqual([{ shipId: "b", name: "Name b" }]);
  });

  it("ignores a ship still under construction and does not recount a pre-existing one", () => {
    const before = fleetSnapshot([ship("a", false), ship("c", true)]);
    const after = fleetSnapshot([ship("a", false), ship("b", true), ship("c", true)]);
    expect(completedShips(before, after)).toEqual([]);
  });
});

describe("shipNameLookup", () => {
  it("names a ship lost during the month from the pre-month fleet and a survivor from either", () => {
    const lookup = shipNameLookup(
      fleetSnapshot([ship("sunk", false), ship("kept", false)]),
      fleetSnapshot([ship("kept", false)]),
    );
    expect(lookup("sunk")).toBe("Name sunk");
    expect(lookup("kept")).toBe("Name kept");
    expect(lookup("unknown")).toBe(undefined);
  });
});

describe("newlyActiveProjectIds (pre→post status delta)", () => {
  it("counts projects that became ACTIVE, including ones absent before", () => {
    const before = projectSnapshot([
      { id: "p1", status: "PLANNED" },
      { id: "p2", status: "ACTIVE" },
    ]);
    const after = projectSnapshot([
      { id: "p1", status: "ACTIVE" },
      { id: "p2", status: "ACTIVE" },
      { id: "p3", status: "ACTIVE" },
      { id: "p4", status: "HALTED" },
    ]);
    expect(newlyActiveProjectIds(before, after)).toEqual(["p1", "p3"]);
  });
});

describe("event derivations", () => {
  const construction = envelope({
    kind: "ConstructionProgressed",
    projectId: "p1",
    nationId: "uk",
    previousWork: SafeInt(10),
    newWork: SafeInt(25),
    workAdded: SafeInt(15),
  });
  const foreignConstruction = envelope({
    kind: "ConstructionProgressed",
    projectId: "p2",
    nationId: "france",
    previousWork: SafeInt(1),
    newWork: SafeInt(2),
    workAdded: SafeInt(1),
  });
  const research = envelope({
    kind: "ResearchProgressed",
    nationId: "uk",
    techId: "tech_steam",
    previousPoints: SafeInt(4),
    newPoints: SafeInt(9),
  });
  const discovery = envelope({
    kind: "TechnologyDiscovered",
    nationId: "uk",
    techId: "tech_radio",
    researchFieldId: "ELECTRONICS",
    discoveryMonth: "1880-02",
    cost: SafeInt(100),
  });
  const foreignDiscovery = envelope({
    kind: "TechnologyDiscovered",
    nationId: "france",
    techId: "tech_x",
    researchFieldId: "GUNNERY",
    discoveryMonth: "1880-02",
    cost: SafeInt(50),
  });

  it("projects real construction progress for the registered nation only", () => {
    expect(constructionProgressFromEvents([construction, foreignConstruction], "uk")).toEqual([
      { projectId: "p1", previousWork: 10, newWork: 25 },
    ]);
  });

  it("projects real research progress for the registered nation only", () => {
    expect(researchProgressFromEvents([research, foreignConstruction], "uk")).toEqual([
      { techId: "tech_steam", previousPoints: 4, newPoints: 9 },
    ]);
  });

  it("projects discoveries for the registered nation only", () => {
    expect(discoveriesFromEvents([discovery, foreignDiscovery], "uk")).toEqual([
      { techId: "tech_radio", researchFieldId: "ELECTRONICS" },
    ]);
  });

  it("ignores event kinds that are not part of the section", () => {
    expect(constructionProgressFromEvents([research, discovery], "uk")).toEqual([]);
  });
});

describe("presenceFromEvents", () => {
  const shortfall = (nationId: string, areaId: string) =>
    envelope({
      kind: "PresenceShortfall",
      nationId,
      areaId,
      requiredTons: SafeInt(1200),
      presentTons: SafeInt(300),
      shortfallTons: SafeInt(900),
    });
  const prestige = (nationId: string, reasonCode: string, delta: number) =>
    envelope({
      kind: "PrestigeChanged",
      nationId,
      reasonCode,
      ruleKind: "FIXED_LOSS",
      before: SafeInt(20),
      after: SafeInt(20 + delta),
      delta: SafeInt(delta),
      rulesetVersion: "0.1.0",
    });

  it("is absent when the player had no shortfall", () => {
    expect(presenceFromEvents([prestige("uk", "PRESENCE_SHORTFALL", -1)], "uk")).toBeUndefined();
    expect(presenceFromEvents([shortfall("france", "med_malta")], "uk")).toBeUndefined();
  });

  it("carries the player's shortfalls and the presence prestige change only", () => {
    expect(
      presenceFromEvents(
        [
          shortfall("uk", "med_malta"),
          shortfall("france", "med_malta"),
          prestige("uk", "PRESENCE_SHORTFALL", -2),
          prestige("uk", "BATTLE_LOST", -5),
        ],
        "uk",
      ),
    ).toEqual({
      shortfalls: [
        { areaId: "med_malta", requiredTons: 1200, presentTons: 300, shortfallTons: 900 },
      ],
      prestigeDelta: -2,
    });
  });
});

describe("fleetExerciseFromEvents", () => {
  const scheduled = (nationId: string) =>
    envelope({
      kind: "FleetExerciseScheduled",
      nationId,
      month: "1880-03",
      shipIds: ["s1", "s2"],
    });
  const completed = (nationId: string) =>
    envelope({
      kind: "FleetExerciseCompleted",
      nationId,
      month: "1880-03",
      shipIds: ["s1", "s2"],
      experienceGained: SafeInt(5),
    });
  const raised = (nationId: string, otherNationId: string, before: number, after: number) =>
    envelope({
      kind: "ExerciseTensionRaised",
      nationId,
      otherNationId,
      before: SafeInt(before),
      after: SafeInt(after),
      delta: SafeInt(after - before),
    });

  it("is absent when the player held no exercise event", () => {
    expect(fleetExerciseFromEvents([scheduled("france"), completed("france")], "uk")).toBe(
      undefined,
    );
  });

  it("carries the scheduling, the result and the tension rows ordered by nation id", () => {
    expect(
      fleetExerciseFromEvents(
        [
          scheduled("uk"),
          completed("uk"),
          raised("uk", "russia", 2, 3),
          raised("uk", "france", 5, 6),
          raised("france", "uk", 1, 2),
        ],
        "uk",
      ),
    ).toEqual({
      scheduled: { month: "1880-03", shipIds: ["s1", "s2"] },
      completed: { month: "1880-03", shipIds: ["s1", "s2"], experienceGained: 5 },
      tension: [
        { otherNationId: "france", before: 5, after: 6 },
        { otherNationId: "russia", before: 2, after: 3 },
      ],
    });
  });

  it("omits the parts that did not happen this month", () => {
    expect(fleetExerciseFromEvents([scheduled("uk")], "uk")).toEqual({
      scheduled: { month: "1880-03", shipIds: ["s1", "s2"] },
      tension: [],
    });
  });
});

describe("unrestFromEvents", () => {
  const changed = (nationId: string, reasonCode: string, before: number, after: number) =>
    envelope({
      kind: "UnrestChanged",
      nationId,
      reasonCode,
      before: SafeInt(before),
      after: SafeInt(after),
      delta: SafeInt(after - before),
      rulesetVersion: "0.1.0",
    });
  const consequence = (nationId: string, kind: "STRIKE" | "REVOLUTION") =>
    envelope({
      kind: "UnrestConsequence",
      nationId,
      consequence: kind,
      unrest: SafeInt(8),
      rateBeforeBp: SafeInt(10000),
      rateAfterBp: SafeInt(8000),
      careerEnded: kind === "REVOLUTION",
      rulesetVersion: "0.1.0",
    });

  it("is absent when the player's unrest did not move", () => {
    expect(unrestFromEvents([changed("france", "BUDGET_PRESSURE", 1, 2)], "uk")).toBeUndefined();
  });

  it("carries the opening and closing unrest, the reasons and the consequence", () => {
    expect(
      unrestFromEvents(
        [
          changed("uk", "BUDGET_PRESSURE", 3, 5),
          changed("france", "BUDGET_PRESSURE", 1, 2),
          changed("uk", "BATTLE_LOST", 5, 7),
          consequence("uk", "STRIKE"),
        ],
        "uk",
      ),
    ).toEqual({
      before: 3,
      after: 7,
      changes: [
        { reasonCode: "BUDGET_PRESSURE", delta: 2 },
        { reasonCode: "BATTLE_LOST", delta: 2 },
      ],
      consequences: [{ consequence: "STRIKE", careerEnded: false }],
    });
  });
});

describe("activeShipCount", () => {
  it("counts only non-under-construction ships", () => {
    expect(
      activeShipCount(fleetSnapshot([ship("a", false), ship("b", true), ship("c", false)])),
    ).toBe(2);
  });
});
