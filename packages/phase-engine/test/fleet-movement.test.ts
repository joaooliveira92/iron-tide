import type { CampaignSnapshot } from "@bluewave/campaign";
import { fleetMoveProblem } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";

function world(): CampaignSnapshot {
  const base = makeBattleSnapshot({ areas: ["a-1", "a-2", "a-3"], wars: [] });
  return {
    ...base,
    world: {
      areas: [...base.world.areas, { id: "land-1", name: "land-1", type: "land" }],
      routes: [
        { id: "r1", from: "a-1", to: "a-2", type: "sea", distance: 100 as never },
        { id: "r2", from: "a-2", to: "a-3", type: "sea", distance: 100 as never },
        { id: "r3", from: "a-1", to: "land-1", type: "sea", distance: 10 as never },
      ],
      ports: [],
    },
  };
}

function fleetIdOf(snapshot: CampaignSnapshot): string {
  return snapshot.nations.get(ATTACKER_NATION)!.fleets[0]!.id;
}

function move(snapshot: CampaignSnapshot, toAreaId: string): CommandEnvelope<CommandBody> {
  return {
    commandId: `mv-${toAreaId}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `ik-${toAreaId}`,
    timestamp: "test",
    body: {
      type: "MoveFleet",
      nationId: ATTACKER_NATION,
      fleetId: fleetIdOf(snapshot),
      toAreaId,
    },
  };
}

function run(snapshot: CampaignSnapshot, commands: CommandEnvelope<CommandBody>[]) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(snapshot, commands, "move-seed", collector);
  const nation = result.finalSnapshot.nations.get(ATTACKER_NATION)!;
  return { result, nation, collector };
}

describe("fleetMoveProblem", () => {
  const snapshot = world();
  const fleetId = fleetIdOf(snapshot);
  it("allows one hop along a route, in either direction", () => {
    expect(fleetMoveProblem(snapshot, ATTACKER_NATION, fleetId, "a-2")).toBeNull();
  });
  it("rejects two hops, land, the current area, unknown areas and other nations' fleets", () => {
    const code = (to: string) => fleetMoveProblem(snapshot, ATTACKER_NATION, fleetId, to)?.code;
    expect(code("a-3")).toBe("INVALID_ROUTE");
    expect(code("land-1")).toBe("INVALID_ROUTE");
    expect(code("a-1")).toBe("INVALID_ROUTE");
    expect(code("nowhere")).toBe("INVALID_ROUTE");
    expect(fleetMoveProblem(snapshot, "FRA", fleetId, "a-2")?.code).toBe("INVALID_COMMAND_PAYLOAD");
    expect(fleetMoveProblem(snapshot, "XXX", fleetId, "a-2")?.code).toBe("INVALID_NATION_ID");
  });
});

describe("a ship under rebuild cannot sail (DESIGN-23 section 20, ADR-0078)", () => {
  const withAvailability = (all: boolean): CampaignSnapshot => {
    const s = world();
    const nation = s.nations.get(ATTACKER_NATION)!;
    const [first, ...rest] = nation.fleets;
    const own = first!.ships[0]!;
    const ships = [
      { ...own, availability: "UNAVAILABLE" as const, availabilityProjectId: "project-rebuild" },
      all
        ? { ...own, id: `${own.id}-b`, availability: "UNAVAILABLE" as const }
        : { ...own, id: `${own.id}-b` },
    ];
    return {
      ...s,
      nations: new Map([
        ...s.nations,
        [ATTACKER_NATION, { ...nation, fleets: [{ ...first!, ships }, ...rest] }],
      ]),
    };
  };
  it("refuses a fleet that has an unavailable ship aboard, naming the ship", () => {
    const s = withAvailability(false);
    const problem = fleetMoveProblem(s, ATTACKER_NATION, fleetIdOf(s), "a-2");
    expect(problem?.code).toBe("SHIP_UNAVAILABLE");
    expect(problem?.message).toContain("under rebuild");
  });
  it("refuses a fleet whose every ship is unavailable as having no operational ship", () => {
    const s = withAvailability(true);
    expect(fleetMoveProblem(s, ATTACKER_NATION, fleetIdOf(s), "a-2")?.code).toBe(
      "SHIP_NOT_OPERATIONAL",
    );
  });
  it("leaves the fleet where it is when the month runs the order", () => {
    const s = withAvailability(true);
    const before = s.nations.get(ATTACKER_NATION)!.fleets[0]!;
    const { nation } = run(s, [move(s, "a-2")]);
    expect(nation.fleets[0]!.locationAreaId).toBe(before.locationAreaId);
    expect(nation.fleets[0]!.ships.map((x) => x.locationAreaId)).toEqual(
      before.ships.map((x) => x.locationAreaId),
    );
  });
});

describe("MoveFleet through the month", () => {
  it("relocates the fleet and its ships when the month runs", () => {
    const snapshot = world();
    const { nation, result } = run(snapshot, [move(snapshot, "a-2")]);
    expect(result.success).toBe(true);
    const fleet = nation.fleets[0]!;
    expect(fleet.locationAreaId).toBe("a-2");
    expect(fleet.ships.every((s) => s.locationAreaId === "a-2")).toBe(true);
  });

  it("covers a second hop only in a following month", () => {
    const snapshot = world();
    const first = run(snapshot, [move(snapshot, "a-2")]);
    expect(first.nation.fleets[0]!.locationAreaId).toBe("a-2");
    const second = run(first.result.finalSnapshot, [move(first.result.finalSnapshot, "a-3")]);
    expect(second.nation.fleets[0]!.locationAreaId).toBe("a-3");
  });

  it("leaves the fleet where it is when the order is not a legal hop", () => {
    const snapshot = world();
    const { nation } = run(snapshot, [move(snapshot, "a-3")]);
    expect(nation.fleets[0]!.locationAreaId).toBe("a-1");
  });
});
