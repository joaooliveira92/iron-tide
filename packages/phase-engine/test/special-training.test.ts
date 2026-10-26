import {
  economyOutlook,
  type CampaignSnapshot,
  isTrainingProficient,
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

function makeSnapshot(ships: Ship[], divisions: never[]): CampaignSnapshot {
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

const FLEET = [makeShip("s1"), makeShip("s2")];

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

const fund = (subjects: string[]): CommandBody => ({
  type: "SetSpecialTraining",
  nationId: "GBR",
  subjects,
});

const programOf = (s: CampaignSnapshot) => s.nations.get("GBR")!.specialTraining;

describe("special training program", () => {
  it("funds up to the subject limit and counts a funded month each month, capping at proficiency", () => {
    let snapshot = makeSnapshot(FLEET, []);
    ({ next: snapshot } = month(snapshot, [fund(["NIGHT_FIGHTING", "GUNNERY"])]));
    expect(programOf(snapshot)).toEqual([
      { subject: "GUNNERY", fundedMonths: 1, maintenanceAdderBp: 3000 },
      { subject: "NIGHT_FIGHTING", fundedMonths: 1, maintenanceAdderBp: 2000 },
    ]);
    for (let i = 0; i < 14; i++) ({ next: snapshot } = month(snapshot));
    expect(programOf(snapshot)!.map((entry) => entry.fundedMonths)).toEqual([12, 12]);
  });

  it("is proficient at the twelfth funded month and not before", () => {
    let snapshot = makeSnapshot(FLEET, []);
    ({ next: snapshot } = month(snapshot, [fund(["GUNNERY"])]));
    for (let i = 0; i < 10; i++) ({ next: snapshot } = month(snapshot));
    const rules = FIXTURE_FLEET_MANAGEMENT_RULES.training;
    expect(isTrainingProficient(programOf(snapshot)![0]!, rules.proficiencyMonths)).toBe(false);
    ({ next: snapshot } = month(snapshot));
    expect(programOf(snapshot)![0]!.fundedMonths).toBe(12);
    expect(isTrainingProficient(programOf(snapshot)![0]!, rules.proficiencyMonths)).toBe(true);
  });

  it("refuses a third subject with a typed code and leaves the program untouched", () => {
    const first = month(makeSnapshot(FLEET, []), [fund(["GUNNERY"])]);
    const refused = month(first.next, [fund(["GUNNERY", "NIGHT_FIGHTING", "DAMAGE_CONTROL"])]);
    expect(refused.collector.all.map((d) => d.code)).toContain("TRAINING_SUBJECT_LIMIT_EXCEEDED");
    expect(programOf(refused.next)!.map((entry) => entry.subject)).toEqual(["GUNNERY"]);
  });

  it("refuses unknown and repeated subjects at validation", () => {
    for (const subjects of [["SEAMANSHIP"], ["GUNNERY", "GUNNERY"]]) {
      const { result } = month(makeSnapshot(FLEET, []), [fund(subjects)]);
      expect(result.commandLedger.all.some((o) => o.type === "rejected")).toBe(true);
      expect(programOf(result.finalSnapshot)).toBeUndefined();
    }
  });

  it("resets a subject the moment funding stops and keeps the one still funded", () => {
    let snapshot = makeSnapshot(FLEET, []);
    ({ next: snapshot } = month(snapshot, [fund(["GUNNERY", "NIGHT_FIGHTING"])]));
    for (let i = 0; i < 4; i++) ({ next: snapshot } = month(snapshot));
    expect(programOf(snapshot)!.map((entry) => entry.fundedMonths)).toEqual([5, 5]);

    ({ next: snapshot } = month(snapshot, [fund(["GUNNERY"])]));
    expect(programOf(snapshot)).toEqual([
      { subject: "GUNNERY", fundedMonths: 6, maintenanceAdderBp: 3000 },
    ]);

    ({ next: snapshot } = month(snapshot, [fund(["GUNNERY", "NIGHT_FIGHTING"])]));
    expect(programOf(snapshot)!.find((e) => e.subject === "NIGHT_FIGHTING")!.fundedMonths).toBe(1);

    ({ next: snapshot } = month(snapshot, [fund([])]));
    expect(programOf(snapshot)).toBeUndefined();
  });

  it("funds a nation at its ruleset cost multiplier and every other nation at the base adder", () => {
    const discounted = {
      fleetManagement: {
        ...FIXTURE_FLEET_MANAGEMENT_RULES,
        training: {
          ...FIXTURE_FLEET_MANAGEMENT_RULES.training,
          nationCostMultiplierBp: { GBR: 8_000 },
        },
      },
    };
    const { next } = month(
      makeSnapshot(FLEET, []),
      [fund(["NIGHT_FIGHTING", "GUNNERY"])],
      discounted,
    );
    expect(programOf(next)).toEqual([
      { subject: "GUNNERY", fundedMonths: 1, maintenanceAdderBp: 2_400 },
      { subject: "NIGHT_FIGHTING", fundedMonths: 1, maintenanceAdderBp: 1_600 },
    ]);
    const other = {
      fleetManagement: {
        ...discounted.fleetManagement,
        training: {
          ...discounted.fleetManagement.training,
          nationCostMultiplierBp: { FRA: 8_000 },
        },
      },
    };
    const { next: unlisted } = month(makeSnapshot(FLEET, []), [fund(["GUNNERY"])], other);
    expect(programOf(unlisted)![0]!.maintenanceAdderBp).toBe(3_000);
  });

  it("is refused while the fleet-management section is dormant", () => {
    const { collector, result } = month(makeSnapshot(FLEET, []), [fund(["GUNNERY"])], {});
    expect(collector.all.map((d) => d.code)).toContain("TRAINING_DORMANT");
    expect(programOf(result.finalSnapshot)).toBeUndefined();
  });
});

describe("special training maintenance", () => {
  const withProgram = (ships: Ship[]) => {
    const snapshot = makeSnapshot(ships, []);
    const nation = snapshot.nations.get("GBR")!;
    nation.specialTraining = [
      { subject: "GUNNERY", fundedMonths: 3, maintenanceAdderBp: 3000 },
      { subject: "NIGHT_FIGHTING", fundedMonths: 3, maintenanceAdderBp: 2000 },
    ];
    return snapshot;
  };

  const executed = (snapshot: CampaignSnapshot) =>
    Number(month(snapshot).result.finalSnapshot.nations.get("GBR")!.maintenanceCost);

  it("adds the subjects' percentages to ACTIVE ships only", () => {
    const base = makeSnapshot([makeShip("s1"), makeShip("s2", { readiness: "MOTHBALLED" })], []);
    const trained = withProgram([makeShip("s1"), makeShip("s2", { readiness: "MOTHBALLED" })]);
    const baseCost = executed(base);
    expect(executed(trained)).toBe(baseCost + 5);
  });

  it("projects exactly what the month then charges", () => {
    const trained = withProgram([makeShip("s1"), makeShip("s2"), makeShip("s3")]);
    expect(economyOutlook(trained, "GBR")!.maintenance).toBe(executed(trained));
    expect(economyOutlook(trained, "GBR")!.maintenance).toBeGreaterThan(
      economyOutlook(makeSnapshot([makeShip("s1"), makeShip("s2"), makeShip("s3")], []), "GBR")!
        .maintenance,
    );
  });
});
