import type { CampaignSnapshot, NationState, Ship } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { transitionShipReadiness } from "../src/stationAssignment.js";

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
    campaignId: "station-assignment",
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
  new MonthExecutor().execute(from, commands, "station-seed", new DiagnosticCollector());

const shipsOf = (s: CampaignSnapshot) => s.nations.get("GBR")!.fleets[0]!.ships;

describe("S-5 03: foreign-station assign and clear commands", () => {
  it("assigns two ships, records one event each, and leaves S-1 state untouched", () => {
    const from = makeSnapshot([makeShip("a"), makeShip("b"), makeShip("c")]);
    const result = run(from, [
      envelope({ type: "AssignForeignStation", nationId: "GBR", shipIds: ["b", "a"] }, from),
    ]);
    expect(result.success).toBe(true);
    const ships = shipsOf(result.finalSnapshot);
    expect(ships.map((s) => s.stationAssignment)).toEqual([
      "FOREIGN_STATION",
      "FOREIGN_STATION",
      undefined,
    ]);
    expect(ships.every((s) => s.readiness === "ACTIVE" && Number(s.crewQuality) === 100)).toBe(
      true,
    );
    const events = result.eventLedger.all.filter(
      (e) => e.body.kind === "ShipStationAssignmentChanged",
    );
    expect(events.map((e) => (e.body as { shipId: string }).shipId)).toEqual(["a", "b"]);
    expect((events[0]!.body as { reason: string }).reason).toBe("ASSIGNED");
  });

  it("an FS ship costs exactly what the same ACTIVE ship costs (S-1 output unchanged)", () => {
    const plain = run(makeSnapshot([makeShip("a")]), []);
    const fs = run(makeSnapshot([makeShip("a", { stationAssignment: "FOREIGN_STATION" })]), []);
    const cost = (r: typeof plain) => r.finalSnapshot.nations.get("GBR")!.maintenanceCost;
    expect(cost(fs)).toBe(cost(plain));
    expect(shipsOf(fs.finalSnapshot)[0]!.crewQuality).toBe(
      shipsOf(plain.finalSnapshot)[0]!.crewQuality,
    );
  });

  it("rejects the whole batch when one ship is ineligible, changing nothing", () => {
    const from = makeSnapshot([makeShip("a"), makeShip("r", { readiness: "RESERVE" })]);
    const outcomes = run(from, [
      envelope({ type: "AssignForeignStation", nationId: "GBR", shipIds: ["a", "r"] }, from),
    ]);
    expect(shipsOf(outcomes.finalSnapshot).every((s) => s.stationAssignment === undefined)).toBe(
      true,
    );
    const rejected = outcomes.commandLedger.all.find((o) => o.type === "rejected");
    expect(rejected).toBeDefined();
    if (rejected?.type === "rejected") {
      expect(rejected.diagnostic.code).toBe("STATION_ASSIGNMENT_REJECTED");
      expect(rejected.diagnostic.message).toContain("r=NOT_ACTIVE");
    }
  });

  it("clears an assigned ship and rejects clearing an unassigned one", () => {
    const from = makeSnapshot([
      makeShip("a", { stationAssignment: "FOREIGN_STATION" }),
      makeShip("b"),
    ]);
    const ok = run(from, [
      envelope({ type: "ClearForeignStation", nationId: "GBR", shipIds: ["a"] }, from),
    ]);
    expect(shipsOf(ok.finalSnapshot)[0]!.stationAssignment).toBeUndefined();
    const ev = ok.eventLedger.all.find((e) => e.body.kind === "ShipStationAssignmentChanged");
    expect((ev!.body as { reason: string }).reason).toBe("CLEARED_BY_COMMAND");
    const bad = run(from, [
      envelope({ type: "ClearForeignStation", nationId: "GBR", shipIds: ["b"] }, from),
    ]);
    expect(shipsOf(bad.finalSnapshot)[0]!.stationAssignment).toBe("FOREIGN_STATION");
    expect(bad.commandLedger.all.some((o) => o.type === "rejected")).toBe(true);
  });

  it("applies a stale second assignment of the same ship as a no-op", () => {
    const from = makeSnapshot([makeShip("a")]);
    const cmd = (n: number): CommandEnvelope<CommandBody> => ({
      ...envelope({ type: "AssignForeignStation", nationId: "GBR", shipIds: ["a"] }, from),
      commandId: `cmd-${String(n)}`,
      idempotencyKey: `ik-${String(n)}`,
    });
    const result = run(from, [cmd(1), cmd(2)]);
    const events = result.eventLedger.all.filter(
      (e) => e.body.kind === "ShipStationAssignmentChanged",
    );
    expect(events).toHaveLength(1);
    expect(shipsOf(result.finalSnapshot)[0]!.stationAssignment).toBe("FOREIGN_STATION");
  });

  it("is deterministic: the same inputs give identical final hashes", () => {
    const from = makeSnapshot([makeShip("a"), makeShip("b")]);
    const cmds = [
      envelope({ type: "AssignForeignStation", nationId: "GBR", shipIds: ["a"] }, from),
    ];
    const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
    expect(hash(run(from, cmds))).toBe(hash(run(from, cmds)));
  });
});

describe("S-5 03: readiness leaving ACTIVE clears the assignment", () => {
  it.each(["RESERVE", "MOTHBALLED", "REPAIR", "WORKING_UP"] as const)(
    "clears it and emits exactly one cleared event for %s",
    (to) => {
      const from = makeSnapshot([makeShip("a", { stationAssignment: "FOREIGN_STATION" })]);
      const result = run(from, []);
      expect(result.success).toBe(true);
      const ctxEvents: { body: { kind: string; reason?: string } }[] = [];
      const out = transitionShipReadiness(from, "GBR", "a", to, "TEST_REASON", {
        campaignMonth: "1880-01",
        nextSeq: (() => {
          let n = 0;
          return () => SafeInt(++n);
        })(),
        append: (e) => ctxEvents.push(e),
      });
      const ship = shipsOf(out)[0]!;
      expect(ship.readiness).toBe(to);
      expect(ship.stationAssignment).toBeUndefined();
      const cleared = ctxEvents.filter((e) => e.body.kind === "ShipStationAssignmentChanged");
      expect(cleared).toHaveLength(1);
      expect(cleared[0]!.body.reason).toBe("READINESS_LEFT_ACTIVE");
      expect(ctxEvents.filter((e) => e.body.kind === "ShipReadinessChanged")).toHaveLength(1);
    },
  );
});
