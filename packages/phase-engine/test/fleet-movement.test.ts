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

function move(
  snapshot: CampaignSnapshot,
  toAreaId: string,
  shipIds?: readonly string[],
): CommandEnvelope<CommandBody> {
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
      ...(shipIds === undefined ? {} : { shipIds }),
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
  it("allows a multi-hop target and rejects an unreachable one with a tag", () => {
    expect(fleetMoveProblem(snapshot, ATTACKER_NATION, fleetId, "a-3")).toBeNull();
    const isolated: CampaignSnapshot = {
      ...snapshot,
      world: {
        ...snapshot.world,
        areas: [...snapshot.world.areas, { id: "a-9", name: "a-9", type: "sea" }],
      },
    };
    expect(fleetMoveProblem(isolated, ATTACKER_NATION, fleetId, "a-9")?._tag).toBe("NoSeaRoute");
  });
  it("rejects land, the current area, unknown areas and other nations' fleets", () => {
    const code = (to: string) => fleetMoveProblem(snapshot, ATTACKER_NATION, fleetId, to)?.code;
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
    expect(problem?._tag).toBe("ShipUnderRebuild");
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

  it("covers a two-hop order in two months and clears the standing route on arrival", () => {
    const snapshot = world();
    const first = run(snapshot, [move(snapshot, "a-3")]);
    expect(first.nation.fleets[0]!.locationAreaId).toBe("a-2");
    expect(first.nation.fleets[0]!.destinationAreaId).toBe("a-3");
    const second = run(first.result.finalSnapshot, []);
    expect(second.nation.fleets[0]!.locationAreaId).toBe("a-3");
    expect(second.nation.fleets[0]!.destinationAreaId).toBeUndefined();
    expect(second.nation.fleets[0]!.ships.every((s) => s.locationAreaId === "a-3")).toBe(true);
  });

  it("replaces a standing route with a new order", () => {
    const snapshot = world();
    const first = run(snapshot, [move(snapshot, "a-3")]);
    const back = run(first.result.finalSnapshot, [move(first.result.finalSnapshot, "a-1")]);
    expect(back.nation.fleets[0]!.locationAreaId).toBe("a-1");
    expect(back.nation.fleets[0]!.destinationAreaId).toBeUndefined();
  });

  it("leaves the fleet where it is when the order targets land", () => {
    const snapshot = world();
    const { nation } = run(snapshot, [move(snapshot, "land-1")]);
    expect(nation.fleets[0]!.locationAreaId).toBe("a-1");
    expect(nation.fleets[0]!.destinationAreaId).toBeUndefined();
  });

  it("detaches an ordered subset into its own fleet and keeps the rest in place", () => {
    const snapshot = world();
    const { nation } = run(snapshot, [move(snapshot, "a-3", ["g1"])]);
    const original = nation.fleets.find((f) => f.id === fleetIdOf(snapshot))!;
    const detached = nation.fleets.find((f) => f.id !== fleetIdOf(snapshot))!;
    expect(original.ships.map((s) => s.id)).toEqual(["g2"]);
    expect(original.locationAreaId).toBe("a-1");
    expect(detached.ships.map((s) => s.id)).toEqual(["g1"]);
    expect(detached.locationAreaId).toBe("a-2");
    expect(detached.destinationAreaId).toBe("a-3");
    expect(detached.id.startsWith("fleet-fs-")).toBe(false);
    expect(detached.ships[0]!.locationAreaId).toBe("a-2");
  });

  it("moves the whole fleet when the subset names every ship", () => {
    const snapshot = world();
    const { nation } = run(snapshot, [move(snapshot, "a-2", ["g2", "g1"])]);
    expect(nation.fleets).toHaveLength(1);
    expect(nation.fleets[0]!.locationAreaId).toBe("a-2");
  });

  it("rejects a subset naming a ship outside the fleet", () => {
    const snapshot = world();
    const problem = fleetMoveProblem(snapshot, ATTACKER_NATION, fleetIdOf(snapshot), "a-2", ["zz"]);
    expect(problem?._tag).toBe("ShipNotInFleet");
  });

  it("is deterministic across runs", () => {
    const snapshot = world();
    const one = run(snapshot, [move(snapshot, "a-3", ["g1"])]);
    const two = run(snapshot, [move(snapshot, "a-3", ["g1"])]);
    expect(sha256Hex(canonicalSerialize(one.result.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(two.result.finalSnapshot)),
    );
  });
});
