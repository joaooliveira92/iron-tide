import type { CampaignSlot, CampaignSnapshot, PermanentDivision } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { applyDivisionCommandMonth } from "../src/divisionCommands.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function makeDivision(): PermanentDivision {
  return {
    divisionId: "div-1",
    nationId: "GBR",
    shipOrder: ["s1", "s2", "s3"],
    flagshipShipId: "s1",
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: "a-1",
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "1.0",
    aggregateHash: "x",
  } as PermanentDivision;
}

function makeSnapshot(): CampaignSnapshot {
  const ship = (id: string) => ({
    id,
    name: id,
    classId: "battleship",
    nationId: "GBR",
    locationAreaId: "a-1",
    designVersionId: "",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(200),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
  });
  const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "division-reorder-test",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [slot],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        {
          id: "GBR",
          name: "GBR",
          tag: "GBR",
          treasury: SafeInt(10000),
          income: SafeInt(0),
          expenses: SafeInt(0),
          baseResources: SafeInt(0),
          navalAppropriationRateBp: SafeInt(2000),
          maintenanceCost: SafeInt(0),
          fleets: [
            {
              id: "fleet-GBR",
              nationId: "GBR",
              name: "GBR Fleet",
              locationAreaId: "a-1",
              ships: [ship("s1"), ship("s2"), ship("s3")],
            },
          ],
          divisions: [makeDivision()],
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
        } as never,
      ],
    ]),
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
    rulesetVersion: "1.0",
    compatibilityVersion: "1.2.0",
  } as CampaignSnapshot;
}

describe("division reorder at month commit (DESIGN-26 §12)", () => {
  it("permutes shipOrder, keeps the flagship and charges cohesion only", () => {
    const next = applyDivisionCommandMonth(
      makeSnapshot(),
      {
        type: "ReorderDivisionShips",
        nationId: "GBR",
        divisionId: "div-1",
        shipOrder: ["s1", "s3", "s2"],
      } as never,
      "1880-02",
      new DiagnosticCollector(),
    );
    const division = next.nations.get("GBR")!.divisions[0]!;
    expect(division.shipOrder).toEqual(["s1", "s3", "s2"]);
    expect(division.flagshipShipId).toBe("s1");
    expect(Number(division.cohesion)).toBe(27);
    expect(Number(division.experience)).toBe(20);
    expect(division.lastReorganizationMonth).toBe("1880-02");
  });

  it("rejects a reorder made stale by an earlier command in the same month", () => {
    const collector = new DiagnosticCollector();
    const withShip = applyDivisionCommandMonth(
      makeSnapshot(),
      { type: "AddShipToDivision", nationId: "GBR", divisionId: "div-1", shipId: "s4" } as never,
      "1880-02",
      collector,
    );
    const after = applyDivisionCommandMonth(
      withShip,
      {
        type: "ReorderDivisionShips",
        nationId: "GBR",
        divisionId: "div-1",
        shipOrder: ["s1", "s3", "s2"],
      } as never,
      "1880-02",
      collector,
    );
    const division = after.nations.get("GBR")!.divisions[0]!;
    expect(division.shipOrder).toEqual(["s1", "s2", "s3", "s4"]);
    expect(division.flagshipShipId).toBe("s1");
    expect(collector.hasErrors).toBe(true);
  });

  it("is deterministic: equal snapshot and order produce equal hashes", () => {
    const body = {
      type: "ReorderDivisionShips",
      nationId: "GBR",
      divisionId: "div-1",
      shipOrder: ["s1", "s3", "s2"],
    } as never;
    const a = applyDivisionCommandMonth(makeSnapshot(), body, "1880-02", new DiagnosticCollector());
    const b = applyDivisionCommandMonth(makeSnapshot(), body, "1880-02", new DiagnosticCollector());
    expect(a.nations.get("GBR")!.divisions[0]!.aggregateHash).toBe(
      b.nations.get("GBR")!.divisions[0]!.aggregateHash,
    );
  });
});
