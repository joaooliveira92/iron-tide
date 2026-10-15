import { SafeInt } from "@bluewave/contracts";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import {
  activeShipCount,
  completedShips,
  constructionProgressFromEvents,
  discoveriesFromEvents,
  newlyActiveProjectIds,
  researchProgressFromEvents,
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

describe("activeShipCount", () => {
  it("counts only non-under-construction ships", () => {
    expect(
      activeShipCount(fleetSnapshot([ship("a", false), ship("b", true), ship("c", false)])),
    ).toBe(2);
  });
});
