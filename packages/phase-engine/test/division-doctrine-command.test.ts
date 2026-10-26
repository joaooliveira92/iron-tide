import {
  divisionAggregateHash,
  campaignMonthId,
  type CampaignSnapshot,
  type PermanentDivision,
  type Ship,
} from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_FLEET_MANAGEMENT_RULES, FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

function makeShip(id: string, over: Partial<Ship> = {}): Ship {
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
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function makeDivision(over: Partial<PermanentDivision> = {}): PermanentDivision {
  const base: PermanentDivision = {
    divisionId: "d1",
    nationId: "GBR",
    shipOrder: ["s1", "s2"],
    flagshipShipId: "s1",
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: "a-1",
    creationMonth: "1879-06",
    lastReorganizationMonth: "1879-06",
    provenanceRefs: [],
    rulesetVersion: "0.1.0",
    aggregateHash: "",
    ...over,
  };
  return { ...base, aggregateHash: divisionAggregateHash(base) };
}

function makeSnapshot(ships: Ship[], divisions: PermanentDivision[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "cohesion-growth",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        {
          prestige: SafeInt(20),
          id: "GBR",
          name: "GBR",
          tag: "GBR",
          treasury: SafeInt(10000),
          income: SafeInt(100),
          expenses: SafeInt(0),
          baseResources: SafeInt(0),
          navalAppropriationRateBp: SafeInt(2000),
          maintenanceCost: SafeInt(0),
          fleets: [
            { id: "fleet-GBR", nationId: "GBR", name: "GBR Fleet", locationAreaId: "a-1", ships },
          ],
          divisions,
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
        },
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
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

const MONTH = campaignMonthId(1880, 1, 1);
const FLEET = [makeShip("s1"), makeShip("s2")];

const envelope = (body: CommandBody, from: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}-${JSON.stringify(body)}`,
  timestamp: "test",
  body,
});

function change(
  doctrine: { divisionRole?: string; preferredFormation?: string },
  active = true,
  division: PermanentDivision = makeDivision(),
) {
  const from = makeSnapshot(FLEET, [division]);
  const result = new MonthExecutor().execute(
    from,
    [
      envelope(
        { type: "ChangeDivisionDoctrine", nationId: "GBR", divisionId: "d1", ...doctrine },
        from,
      ),
    ],
    "seed",
    new DiagnosticCollector(),
    undefined,
    active ? { fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES } : {},
  );
  return {
    result,
    division: result.finalSnapshot.nations.get("GBR")!.divisions[0]!,
    rejection: result.commandLedger.all.find((o) => o.type === "rejected"),
  };
}

describe("division doctrine command", () => {
  it("charges the role penalty, stamps the month and blocks growth in that month", () => {
    const { division, rejection } = change({ divisionRole: "SUPPORT" });
    expect(rejection).toBeUndefined();
    expect(division.divisionRole).toBe("SUPPORT");
    expect(division.cohesion as number).toBe(20);
    expect(division.lastReorganizationMonth).toBe(MONTH);
  });

  it("charges the formation penalty for a formation change", () => {
    const { division } = change({ preferredFormation: "LINE_ABREAST" });
    expect(division.preferredFormation).toBe("LINE_ABREAST");
    expect(division.cohesion as number).toBe(25);
  });

  it("charges both penalties when both change", () => {
    const { division } = change({ divisionRole: "SCREEN", preferredFormation: "SCREEN" });
    expect(division.cohesion as number).toBe(15);
  });

  it("changes the doctrine at no cost while the section is dormant", () => {
    const { division } = change({ divisionRole: "SUPPORT" }, false);
    expect(division.divisionRole).toBe("SUPPORT");
    expect(division.cohesion as number).toBe(30);
  });

  it("resumes growth in the month after the change", () => {
    const first = change({ divisionRole: "SUPPORT" });
    const second = new MonthExecutor().execute(
      { ...first.result.finalSnapshot, turnNumber: SafeInt(2) },
      [],
      "seed-2",
      new DiagnosticCollector(),
      undefined,
      { fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES },
    );
    expect(second.finalSnapshot.nations.get("GBR")!.divisions[0]!.cohesion as number).toBe(22);
  });

  it("rejects an unchanged, empty, unknown or invalid doctrine without touching the division", () => {
    for (const doctrine of [
      { divisionRole: "CORE" },
      {},
      { divisionRole: "ADMIRAL" },
      { preferredFormation: "COLUMN" },
    ]) {
      const { division, rejection } = change(doctrine);
      expect(rejection).toBeDefined();
      expect(division.cohesion as number).toBe(32);
    }
  });
});
