import {
  economyOutlook,
  evaluateShipGates,
  divisionAggregateHash,
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

const envelope = (body: CommandBody, from: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}-${String(from.turnNumber)}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}-${String(from.turnNumber)}-${JSON.stringify(body)}`,
  timestamp: "test",
  body,
});

const OPTIONS = { fleetManagement: FIXTURE_FLEET_MANAGEMENT_RULES };

function month(
  from: CampaignSnapshot,
  commands: CommandBody[] = [],
  options: Parameters<MonthExecutor["execute"]>[5] = OPTIONS,
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    from,
    commands.map((body) => envelope(body, from)),
    "seed",
    collector,
    undefined,
    options,
  );
  const next = {
    ...result.finalSnapshot,
    turnNumber: SafeInt(Number(from.turnNumber) + 1),
  } as CampaignSnapshot;
  return { result, next, collector };
}

const hold = (shipIds: string[]): CommandBody => ({
  type: "HoldFleetExercise",
  nationId: "GBR",
  shipIds,
});

const ships = () => [makeShip("s1"), makeShip("s2"), makeShip("s3"), makeShip("s4")];
const divisions = () => [
  makeDivision({ divisionId: "d1", shipOrder: ["s1", "s2"], lastReorganizationMonth: "1879-06" }),
  makeDivision({
    divisionId: "d2",
    shipOrder: ["s3", "s4"],
    flagshipShipId: "s3",
    lastReorganizationMonth: "1879-06",
  }),
];
const gbr = (s: CampaignSnapshot) => s.nations.get("GBR")!;
const shipOf = (s: CampaignSnapshot, id: string) =>
  gbr(s)
    .fleets.flatMap((f) => f.ships)
    .find((ship) => ship.id === id)!;
const charge = (s: CampaignSnapshot) =>
  Number(month(s).result.finalSnapshot.nations.get("GBR")!.maintenanceCost);

describe("exercise tension", () => {
  const relation = (
    nationB: string,
    kind: "neutral" | "allied" | "at_war" | "trade_agreement",
    tension: number,
  ) => ({ nationA: "GBR", nationB, relation: kind, tension, nap: false, since: "1880-01" });

  const withRelations = (): CampaignSnapshot => {
    const base = makeSnapshot(ships(), divisions());
    return {
      ...base,
      politics: {
        ...base.politics,
        relations: [
          relation("FRA", "neutral", 5),
          relation("GER", "allied", 2),
          relation("RUS", "at_war", 10),
          relation("ITA", "neutral", 7),
          relation("USA", "trade_agreement", 4),
        ],
      },
    };
  };

  const rules = (tension?: { minShips: number; increase: number; ceiling: number }) => ({
    fleetManagement: {
      ...FIXTURE_FLEET_MANAGEMENT_RULES,
      exercise: { ...FIXTURE_FLEET_MANAGEMENT_RULES.exercise, ...(tension ? { tension } : {}) },
    },
  });

  const tensions = (s: CampaignSnapshot) =>
    Object.fromEntries(s.politics.relations.map((r) => [r.nationB, r.tension]));

  const held = (shipIds: string[], options: ReturnType<typeof rules>) => {
    const scheduled = month(withRelations(), [hold(shipIds)], options);
    return month(scheduled.next, [], options).next;
  };

  const TENSION = { minShips: 2, increase: 1, ceiling: 7 };

  it("raises tension with neutral rivals only, never past the ceiling", () => {
    expect(tensions(held(["s1", "s2"], rules(TENSION)))).toEqual({
      FRA: 6,
      GER: 2,
      RUS: 10,
      ITA: 7,
      USA: 4,
    });
  });

  it("does nothing for an exercise smaller than the threshold", () => {
    expect(tensions(held(["s1"], rules(TENSION)))).toEqual({
      FRA: 5,
      GER: 2,
      RUS: 10,
      ITA: 7,
      USA: 4,
    });
  });

  it("does nothing while the ruleset authors no tension consequence", () => {
    expect(tensions(held(["s1", "s2"], rules()))).toEqual({
      FRA: 5,
      GER: 2,
      RUS: 10,
      ITA: 7,
      USA: 4,
    });
  });

  it("applies the consequence once, in the month the exercise is held", () => {
    const options = rules(TENSION);
    const scheduled = month(withRelations(), [hold(["s1", "s2"])], options);
    expect(tensions(scheduled.next).FRA).toBe(5);
    const afterHeld = month(scheduled.next, [], options);
    expect(tensions(afterHeld.next).FRA).toBe(6);
    expect(tensions(month(afterHeld.next, [], options).next).FRA).toBe(6);
  });
});

describe("annual fleet exercise", () => {
  it("schedules the exercise for the next month, occupying the slot without charging this month", () => {
    const base = makeSnapshot(ships(), divisions());
    const baseline = charge(base);
    const scheduled = month(base, [hold(["s2", "s1"])]);
    expect(shipOf(scheduled.next, "s1").stationAssignment).toBe("EXERCISE");
    expect(shipOf(scheduled.next, "s3").stationAssignment).toBeUndefined();
    expect(gbr(scheduled.next).fleetExercise).toEqual({
      month: "1880-03",
      year: 1880,
      yearCount: 1,
      shipIds: ["s1", "s2"],
      maintenanceAdderBp: 10000,
    });
    expect(Number(gbr(scheduled.result.finalSnapshot).maintenanceCost)).toBe(baseline);
  });

  it("charges twice the active maintenance in the exercise month, and the projection says so", () => {
    const base = makeSnapshot(ships(), divisions());
    const baseline = charge(base);
    const { next } = month(base, [hold(["s1", "s2"])]);
    const projected = economyOutlook(next, "GBR")!.maintenance;
    expect(projected).toBe(baseline + 20);
    expect(charge(next)).toBe(projected);
  });

  it("gives experience to the exercising divisions only, then releases the ships", () => {
    const base = makeSnapshot(ships(), divisions());
    const scheduled = month(base, [hold(["s1", "s2"])]);
    const held = month(scheduled.next);
    const after = gbr(held.next);
    expect(after.divisions.find((d) => d.divisionId === "d1")!.experience as number).toBe(25);
    expect(after.divisions.find((d) => d.divisionId === "d2")!.experience as number).toBe(20);
    expect(shipOf(held.next, "s1").stationAssignment).toBeUndefined();
    const later = month(held.next);
    expect(charge(held.next)).toBe(Number(gbr(later.result.finalSnapshot).maintenanceCost));
  });

  it("keeps an exercising ship out of battle for the month", () => {
    const { next } = month(makeSnapshot(ships(), divisions()), [hold(["s1"])]);
    const reasons = evaluateShipGates(shipOf(next, "s1"), "ENTER_BATTLE").map((r) => r._tag);
    expect(reasons).toEqual(["AssignmentForbidsUse"]);
  });

  it("refuses a second exercise in the same calendar year with a typed code", () => {
    const first = month(makeSnapshot(ships(), divisions()), [hold(["s1"])]);
    const done = month(first.next);
    const second = month(done.next, [hold(["s3"])]);
    expect(second.collector.all.map((d) => d.code)).toContain("FLEET_EXERCISE_LIMIT_REACHED");
    expect(shipOf(second.next, "s3").stationAssignment).toBeUndefined();
    expect(gbr(second.next).fleetExercise!.shipIds).toEqual(["s1"]);
  });

  it("allows an exercise again in a new calendar year", () => {
    const first = month(makeSnapshot(ships(), divisions()), [hold(["s1"])]);
    const done = month(first.next);
    const nextYear = { ...done.next, turnNumber: SafeInt(13) } as CampaignSnapshot;
    const again = month(nextYear, [hold(["s3"])]);
    expect(again.collector.all.map((d) => d.code)).not.toContain("FLEET_EXERCISE_LIMIT_REACHED");
    expect(gbr(again.next).fleetExercise).toMatchObject({ year: 1881, yearCount: 1 });
  });

  it("refuses an ineligible ship with its gate code, and refuses while dormant", () => {
    const mothballed = [makeShip("s1", { readiness: "MOTHBALLED" }), makeShip("s2")];
    const refused = month(makeSnapshot(mothballed, []), [hold(["s1"])]);
    const rejection = refused.result.commandLedger.all.find((o) => o.type === "rejected");
    expect(rejection?.type === "rejected" && rejection.diagnostic.code).toBe(
      "FLEET_EXERCISE_REJECTED",
    );
    expect(rejection?.type === "rejected" && rejection.diagnostic.message).toContain(
      "s1=Mothballed",
    );

    const dormant = month(makeSnapshot(ships(), divisions()), [hold(["s1"])], {});
    expect(dormant.collector.all.map((d) => d.code)).toContain("FLEET_EXERCISE_DORMANT");
    expect(gbr(dormant.next).fleetExercise).toBeUndefined();
  });
});
