import type { CampaignSnapshot, NationState, Ship } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";

function makeShip(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "cruiser",
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

function makeNation(ships: Ship[]): NationState {
  return {
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

function makeSnapshot(ships: Ship[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "ship-readiness-command",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", makeNation(ships)]]),
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
    compatibilityVersion: "3.1.0",
  };
}

const envelope = (body: CommandBody, from: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}-${JSON.stringify(body)}`,
  timestamp: "test",
  body,
});

const run = (from: CampaignSnapshot, commands: CommandEnvelope<CommandBody>[]) =>
  new MonthExecutor().execute(from, commands, "readiness-seed", new DiagnosticCollector());

const shipsOf = (s: CampaignSnapshot) => s.nations.get("GBR")!.fleets[0]!.ships;

type Target = "ACTIVE" | "RESERVE" | "MOTHBALLED";

const setReadiness = (from: CampaignSnapshot, shipIds: string[], readiness: Target) =>
  run(from, [envelope({ type: "SetShipReadiness", nationId: "GBR", shipIds, readiness }, from)]);

const rejection = (r: ReturnType<typeof run>) => {
  const rejected = r.commandLedger.all.find((o) => o.type === "rejected");
  return rejected?.type === "rejected" ? rejected.diagnostic : undefined;
};

describe("fleet management: the readiness command", () => {
  it("sets RESERVE with an event, then the crew ramps down by the existing step each month", () => {
    const from = makeSnapshot([makeShip("a")]);
    const result = setReadiness(from, ["a"], "RESERVE");
    expect(result.success).toBe(true);
    const ship = shipsOf(result.finalSnapshot)[0]!;
    expect(ship.readiness).toBe("RESERVE");
    expect(Number(ship.crewQuality)).toBeLessThan(100);
    const events = result.eventLedger.all.filter((e) => e.body.kind === "ShipReadinessChanged");
    expect(events).toHaveLength(1);
    expect((events[0]!.body as { reason: string }).reason).toBe("SET_BY_COMMAND");
    const later = run(result.finalSnapshot, []);
    expect(Number(shipsOf(later.finalSnapshot)[0]!.crewQuality)).toBe(Number(ship.crewQuality) - 5);
  });

  it("charges the new state's maintenance and no one-off fee", () => {
    const base = makeSnapshot([makeShip("a")]);
    const active = run(base, []);
    const mothballed = setReadiness(base, ["a"], "MOTHBALLED");
    const cost = (r: ReturnType<typeof run>) =>
      Number(r.finalSnapshot.nations.get("GBR")!.maintenanceCost);
    expect(cost(mothballed)).toBeLessThan(cost(active));
    const toActive = setReadiness(
      makeSnapshot([makeShip("a", { readiness: "MOTHBALLED", crewQuality: SafeInt(30) })]),
      ["a"],
      "ACTIVE",
    );
    expect(shipsOf(toActive.finalSnapshot)[0]!.readiness).toBe("ACTIVE");
    expect(Number(shipsOf(toActive.finalSnapshot)[0]!.crewQuality)).toBe(35);
  });

  it.each([
    ["UNDER_CONSTRUCTION", { isUnderConstruction: true, readiness: "WORKING_UP" as const }],
    ["UNAVAILABLE", { availability: "UNAVAILABLE" as const }],
    ["WORKING_UP", { readiness: "WORKING_UP" as const }],
    ["REPAIR_IN_PROGRESS", { readiness: "REPAIR" as const, repairMonthsRemaining: SafeInt(3) }],
    ["IN_BATTLE", { inBattleId: "b1" }],
    ["ASSIGNMENT_HELD", { stationAssignment: "FOREIGN_STATION" as const }],
    ["ALREADY_IN_STATE", { readiness: "RESERVE" as const }],
  ])("refuses with %s and changes nothing", (reason, over) => {
    const from = makeSnapshot([makeShip("a", over)]);
    const target: Target =
      reason === "ALREADY_IN_STATE"
        ? "RESERVE"
        : reason === "REPAIR_IN_PROGRESS"
          ? "ACTIVE"
          : "RESERVE";
    const result = setReadiness(from, ["a"], target);
    expect(rejection(result)?.code).toBe("SHIP_READINESS_REJECTED");
    expect(rejection(result)?.message).toContain(`a=${reason}`);
    expect(shipsOf(result.finalSnapshot)).toEqual(shipsOf(run(from, []).finalSnapshot));
  });

  it("refuses a ship the nation does not own", () => {
    const from = makeSnapshot([makeShip("a")]);
    expect(rejection(setReadiness(from, ["ghost"], "RESERVE"))?.message).toContain(
      "ghost=NOT_OWNED",
    );
  });

  it("mothballing a ship under repair pauses the repair and keeps the remaining months", () => {
    const from = makeSnapshot([
      makeShip("a", { readiness: "REPAIR", repairMonthsRemaining: SafeInt(4) }),
    ]);
    const paused = setReadiness(from, ["a"], "MOTHBALLED");
    expect(shipsOf(paused.finalSnapshot)[0]).toMatchObject({
      readiness: "MOTHBALLED",
      repairMonthsRemaining: 4,
    });
    const later = run(paused.finalSnapshot, []);
    expect(shipsOf(later.finalSnapshot)[0]).toMatchObject({
      readiness: "MOTHBALLED",
      repairMonthsRemaining: 4,
    });
  });

  it("is deterministic", () => {
    const from = makeSnapshot([makeShip("a"), makeShip("b")]);
    const hash = () =>
      sha256Hex(canonicalSerialize(setReadiness(from, ["b", "a"], "RESERVE").finalSnapshot));
    expect(hash()).toBe(hash());
  });
});
