// S-5 05 (#79, spec #73 R5/R6/R8/R13): the month-end presence step. A month run over a fixture ruleset records one typed
// PresenceShortfall per nation-area with a shortfall; with the section absent it records nothing and the final hash is
// identical to a run that never heard of S-5.
// EVERY RULESET NUMBER BELOW IS FIXTURE-CLASS: it exercises the mechanics and is never a production value (R11, R14).
import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const FIXTURE_PRESENCE = {
  colonialServiceDisplacementBp: 137,
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "cruiser",
    nationId: "GBR",
    locationAreaId: "india",
    designVersionId: "d-plain",
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

function nation(id: string, ships: Ship[]): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury: SafeInt(10000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: `fleet-${id}`, nationId: id, name: id, locationAreaId: "india", ships }],
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

function design(id: string, kg: number): CompiledDesignVersion {
  return { designVersionId: id, normalizedDisplacementKg: SafeInt(kg) } as CompiledDesignVersion;
}

function snapshot(gbrShips: Ship[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "presence",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      possessions: [
        { id: "p-gbr-2", nationId: "GBR", areaId: "india" },
        { id: "p-gbr-1", nationId: "GBR", areaId: "india" },
        { id: "p-gbr-3", nationId: "GBR", areaId: "cape" },
        { id: "p-fra-1", nationId: "FRA", areaId: "india" },
      ],
    },
    nations: new Map([
      ["GBR", nation("GBR", gbrShips)],
      ["FRA", nation("FRA", [])],
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
    designs: new Map([
      ["d-plain", design("d-plain", 1_000_000)],
      ["d-small", design("d-small", 200_000)],
    ]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

function run(from: CampaignSnapshot, withSection: boolean) {
  return new MonthExecutor().execute(
    from,
    [],
    "presence-seed",
    new DiagnosticCollector(),
    undefined,
    {
      shipBuilding: productionShipBuildingContent(),
      ...(withSection ? { presence: FIXTURE_PRESENCE } : {}),
    },
  );
}

const shortfalls = (r: ReturnType<typeof run>) =>
  r.eventLedger.all.filter((e) => e.body.kind === "PresenceShortfall").map((e) => e.body);

describe("S-5 05: month-end presence step", () => {
  it("emits one typed shortfall event per under-covered nation-area, ordered by nation then area", () => {
    const result = run(snapshot([]), true);
    expect(result.success).toBe(true);
    expect(shortfalls(result)).toEqual([
      // FRA: one possession x 100 x flat weight 2, no ships
      {
        kind: "PresenceShortfall",
        nationId: "FRA",
        areaId: "india",
        requiredTons: 200,
        presentTons: 0,
        shortfallTons: 200,
      },
      // GBR: two in india (400) and one in cape (200)
      {
        kind: "PresenceShortfall",
        nationId: "GBR",
        areaId: "cape",
        requiredTons: 200,
        presentTons: 0,
        shortfallTons: 200,
      },
      {
        kind: "PresenceShortfall",
        nationId: "GBR",
        areaId: "india",
        requiredTons: 400,
        presentTons: 0,
        shortfallTons: 400,
      },
    ]);
  });

  it("an active ship reduces the shortfall; a covered area emits nothing; laid-up ships do not count", () => {
    const covered = run(snapshot([ship("a"), ship("b", { readiness: "RESERVE" })]), true);
    expect(
      shortfalls(covered).filter((e) => e.kind === "PresenceShortfall" && e.nationId === "GBR"),
    ).toEqual([
      {
        kind: "PresenceShortfall",
        nationId: "GBR",
        areaId: "cape",
        requiredTons: 200,
        presentTons: 0,
        shortfallTons: 200,
      },
    ]);
  });

  it("an FS colonial-service ship counts 1.5x its tonnage and one not on FS counts 1x", () => {
    const gbrIndia = (ships: Ship[]) =>
      shortfalls(run(snapshot(ships), true)).find(
        (e) => e.kind === "PresenceShortfall" && e.nationId === "GBR" && e.areaId === "india",
      );
    const colonial = { designVersionId: "d-small", colonialServiceFitted: true as const };
    // india needs 400 t; a 200 t ship covers 200 t, or 300 t when colonial-service on FS.
    expect(gbrIndia([ship("a", { designVersionId: "d-small" })])).toMatchObject({
      presentTons: 200,
      shortfallTons: 200,
    });
    expect(gbrIndia([ship("a", colonial)])).toMatchObject({ presentTons: 200, shortfallTons: 200 });
    expect(
      gbrIndia([ship("a", { ...colonial, stationAssignment: "FOREIGN_STATION" })]),
    ).toMatchObject({
      presentTons: 300,
      shortfallTons: 100,
    });
  });

  it("is dormant without the section: no events and a final hash identical to the pre-S-5 run", () => {
    const from = snapshot([ship("a")]);
    const dormant = run(from, false);
    expect(shortfalls(dormant)).toEqual([]);
    const baseline = new MonthExecutor().execute(
      from,
      [],
      "presence-seed",
      new DiagnosticCollector(),
    );
    const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
    expect(hash(dormant)).toBe(hash(baseline));
  });

  it("does not change authoritative state when the section is present (events only) and is deterministic", () => {
    const from = snapshot([ship("a")]);
    const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
    expect(hash(run(from, true))).toBe(hash(run(from, false)));
    const events = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.eventLedger.all));
    expect(events(run(from, true))).toBe(events(run(from, true)));
  });
});
