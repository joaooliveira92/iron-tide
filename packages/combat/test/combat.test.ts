import { describe, it, expect } from "vite-plus/test";
import { SafeInt, BluewaveError, BP_ONE } from "@bluewave/contracts";
import { RandomEngine, RandomStream } from "@bluewave/random";
import type { BattleInstance, FleetState, NationState, Ship } from "@bluewave/campaign";
import { BattleResolver } from "@bluewave/combat/battleResolution";
import { StrengthCalculator } from "@bluewave/combat/battleResolution";

function makeShip(overrides: Partial<Ship> & { id: string }): Ship {
  return {
    name: "Test Ship",
    classId: "test-class",
    nationId: "test-nation",
    locationAreaId: "area-1",
    designVersionId: "v1",
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
    ...overrides,
  };
}

function makeFleet(overrides: Partial<FleetState> & { id: string; ships: Ship[] }): FleetState {
  return {
    nationId: "test-nation",
    name: "Test Fleet",
    locationAreaId: "area-1",
    ...overrides,
  };
}

function makeNation(
  id: string,
  fleets: FleetState[],
  overrides?: Partial<NationState>,
): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: `Nation ${id}`,
    tag: id,
    treasury: SafeInt(1000),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(1000),
    navalAppropriationRateBp: SafeInt(100),
    maintenanceCost: SafeInt(10),
    fleets,
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
    ...overrides,
  };
}

function cloneNation(n: NationState): NationState {
  return {
    ...n,
    fleets: n.fleets.map((f) => ({ ...f, ships: f.ships.map((s) => ({ ...s })) })),
    divisions: [],
    research: { ...n.research, activeCandidates: new Map(n.research.activeCandidates) },
  };
}

class FakeEngine extends RandomEngine {
  private idx = 0;
  constructor(private draws: number[]) {
    super("fake-master");
  }
  override stream(_domain: string): RandomStream {
    return {
      id: "fake",
      next: () => this.draws[this.idx++ % this.draws.length],
    };
  }
}

describe("combat (narrow) - preserved", () => {
  const resolver = new BattleResolver();

  it("resolves battle with winner and loser determined", () => {
    const attackerShips = [
      makeShip({ id: "att-ship-1", firepower: SafeInt(20), armor: SafeInt(15) }),
      makeShip({ id: "att-ship-2", firepower: SafeInt(18), armor: SafeInt(12) }),
    ];
    const defenderShips = [
      makeShip({ id: "def-ship-1", firepower: SafeInt(5), armor: SafeInt(5) }),
      makeShip({ id: "def-ship-2", firepower: SafeInt(4), armor: SafeInt(5) }),
    ];
    const attFleet = makeFleet({ id: "att-fleet", nationId: "ATK", ships: attackerShips });
    const defFleet = makeFleet({ id: "def-fleet", nationId: "DEF", ships: defenderShips });
    const attackerNation = makeNation("ATK", [attFleet], { tag: "ATK" });
    const defenderNation = makeNation("DEF", [defFleet], { tag: "DEF" });
    const battle: BattleInstance = {
      id: "battle-1",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["att-fleet"],
      defenderFleetIds: ["def-fleet"],
    };
    const engine = new RandomEngine("battle-test-seed");
    const result = resolver.resolve(battle, attackerNation, defenderNation, engine);
    expect(result.winnerId).toBe("ATK");
    expect(result.loserId).toBe("DEF");
    expect(result.explanation.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(result.damageReport).sort()).toEqual(["def-ship-1", "def-ship-2"]);
    expect(result.attackerLosses).toEqual([]);
    for (const v of Object.values(result.damageReport)) {
      expect(v as number).toBeGreaterThanOrEqual(1);
      expect(v as number).toBeLessThanOrEqual(100);
      expect(Number.isSafeInteger(v as number)).toBe(true);
    }
  });

  it("damage is bounded: losses < total ships and damageReport correct", () => {
    const attackerShips = [
      makeShip({ id: "a1", firepower: SafeInt(15), armor: SafeInt(10) }),
      makeShip({ id: "a2", firepower: SafeInt(15), armor: SafeInt(10) }),
    ];
    const defenderShips = [
      makeShip({ id: "d1", firepower: SafeInt(10), armor: SafeInt(10) }),
      makeShip({ id: "d2", firepower: SafeInt(10), armor: SafeInt(10) }),
      makeShip({ id: "d3", firepower: SafeInt(10), armor: SafeInt(10) }),
    ];
    const attFleet = makeFleet({ id: "af", nationId: "ATK", ships: attackerShips });
    const defFleet = makeFleet({ id: "df", nationId: "DEF", ships: defenderShips });
    const attackerNation = makeNation("ATK", [attFleet], { tag: "ATK" });
    const defenderNation = makeNation("DEF", [defFleet], { tag: "DEF" });
    const battle: BattleInstance = {
      id: "battle-2",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["af"],
      defenderFleetIds: ["df"],
    };
    const engine = new RandomEngine("bounded-damage-seed");
    const result = resolver.resolve(battle, attackerNation, defenderNation, engine);
    const totalLoserShips = result.winnerId === "ATK" ? defenderShips.length : attackerShips.length;
    const totalLosses = result.attackerLosses.length + result.defenderLosses.length;
    expect(totalLosses).toBeLessThan(totalLoserShips);
    const loserIds = (result.winnerId === "ATK" ? defenderShips : attackerShips).map((s) => s.id);
    expect(Object.keys(result.damageReport).sort()).toEqual(loserIds.sort());
    for (const id of [...result.attackerLosses, ...result.defenderLosses]) {
      expect(loserIds).toContain(id);
    }
  });

  it("does not mutate input and inBattleId unchanged - resolver is pure", () => {
    const shipsA = [
      makeShip({ id: "sa1", firepower: SafeInt(12), armor: SafeInt(8), inBattleId: "battle-3" }),
      makeShip({ id: "sa2", firepower: SafeInt(12), armor: SafeInt(8), inBattleId: "battle-3" }),
    ];
    const shipsD = [
      makeShip({ id: "sd1", firepower: SafeInt(8), armor: SafeInt(6), inBattleId: "battle-3" }),
      makeShip({ id: "sd2", firepower: SafeInt(8), armor: SafeInt(6), inBattleId: "battle-3" }),
    ];
    const fA = makeFleet({ id: "fleet-a", nationId: "ATK", ships: shipsA });
    const fD = makeFleet({ id: "fleet-d", nationId: "DEF", ships: shipsD });
    const attackerNation = makeNation("ATK", [fA], { tag: "ATK" });
    const defenderNation = makeNation("DEF", [fD], { tag: "DEF" });
    const battle: BattleInstance = {
      id: "battle-3",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["fleet-a"],
      defenderFleetIds: ["fleet-d"],
    };
    const snapshotA = JSON.stringify(attackerNation);
    const snapshotD = JSON.stringify(defenderNation);
    const engine = new RandomEngine("no-duplicate-seed");
    resolver.resolve(battle, attackerNation, defenderNation, engine);
    expect(JSON.stringify(attackerNation)).toBe(snapshotA);
    expect(JSON.stringify(defenderNation)).toBe(snapshotD);
    for (const ship of shipsA) expect(ship.inBattleId).toBe("battle-3");
    for (const ship of shipsD) expect(ship.inBattleId).toBe("battle-3");
  });

  it("explanation tree contains strength comparison and correct winnerEff", () => {
    const shipsA = [makeShip({ id: "xa1", firepower: SafeInt(14), armor: SafeInt(10) })];
    const shipsD = [makeShip({ id: "xd1", firepower: SafeInt(6), armor: SafeInt(5) })];
    const fA = makeFleet({ id: "fa", nationId: "ATK", ships: shipsA });
    const fD = makeFleet({ id: "fd", nationId: "DEF", ships: shipsD });
    const attackerNation = makeNation("ATK", [fA], { tag: "ATK" });
    const defenderNation = makeNation("DEF", [fD], { tag: "DEF" });
    const battle: BattleInstance = {
      id: "battle-4",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["fa"],
      defenderFleetIds: ["fd"],
    };
    const engine = new RandomEngine("explanation-seed");
    const result = resolver.resolve(battle, attackerNation, defenderNation, engine);
    const explanationStr = result.explanation[0] ?? "";
    expect(explanationStr).toContain("battle:resolve");
    expect(explanationStr).toContain("attackerStrength");
    expect(explanationStr).toContain("defenderStrength");
    expect(explanationStr).toContain("attackerEffectiveStrength");
    expect(explanationStr).toContain("defenderEffectiveStrength");
    expect(explanationStr).toContain("battle:losses");
    expect(explanationStr).toMatch(/battle:resolve v1\.0\.0 = \d+/);
  });

  it("deterministic: same seed + same fleets (cloned) = same result", () => {
    const shipsA = [makeShip({ id: "da1", firepower: SafeInt(16), armor: SafeInt(12) })];
    const shipsD = [makeShip({ id: "dd1", firepower: SafeInt(8), armor: SafeInt(6) })];
    const makeState = () => ({
      attackerNation: makeNation(
        "ATK",
        [makeFleet({ id: "dfa", nationId: "ATK", ships: shipsA.map((s) => ({ ...s })) })],
        { tag: "ATK" },
      ),
      defenderNation: makeNation(
        "DEF",
        [makeFleet({ id: "dfd", nationId: "DEF", ships: shipsD.map((s) => ({ ...s })) })],
        { tag: "DEF" },
      ),
      battle: {
        id: "battle-5",
        phase: "pending" as const,
        attackerId: "ATK",
        defenderId: "DEF",
        areaId: "area-1",
        attackerFleetIds: ["dfa"],
        defenderFleetIds: ["dfd"],
      } as BattleInstance,
    });
    const s1 = makeState();
    const s2 = makeState();
    const engine1 = new RandomEngine("deterministic-test-seed");
    const engine2 = new RandomEngine("deterministic-test-seed");
    const r1 = resolver.resolve(s1.battle, s1.attackerNation, s1.defenderNation, engine1);
    const r2 = resolver.resolve(s2.battle, s2.attackerNation, s2.defenderNation, engine2);
    expect(r1.winnerId).toBe(r2.winnerId);
    expect(r1.loserId).toBe(r2.loserId);
    expect(r1.attackerLosses).toEqual(r2.attackerLosses);
    expect(r1.defenderLosses).toEqual(r2.defenderLosses);
    expect(r1.damageReport).toEqual(r2.damageReport);
  });

  it("different draws can flip outcome - deterministic stub not flaky seed loop", () => {
    const shipsA = [makeShip({ id: "rsa1", firepower: SafeInt(20), armor: SafeInt(10) })];
    const shipsD = [makeShip({ id: "rsd1", firepower: SafeInt(19), armor: SafeInt(10) })];
    const fA = makeFleet({ id: "rsfa", nationId: "ATK", ships: shipsA });
    const fD = makeFleet({ id: "rsfd", nationId: "DEF", ships: shipsD });
    const battle: BattleInstance = {
      id: "battle-6",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["rsfa"],
      defenderFleetIds: ["rsfd"],
    };
    const atkNation1 = makeNation("ATK", [fA], { tag: "ATK" });
    const defNation1 = makeNation("DEF", [fD], { tag: "DEF" });
    const engineFavAtk = new FakeEngine([0.99, 0.01, 0.5]);
    const rFavAtk = resolver.resolve(
      battle,
      cloneNation(atkNation1),
      cloneNation(defNation1),
      engineFavAtk as unknown as RandomEngine,
    );
    const engineFavDef = new FakeEngine([0.01, 0.99, 0.5]);
    const rFavDef = resolver.resolve(
      battle,
      cloneNation(atkNation1),
      cloneNation(defNation1),
      engineFavDef as unknown as RandomEngine,
    );
    expect(rFavAtk.winnerId).toBe("ATK");
    expect(rFavDef.winnerId).toBe("DEF");
  });

  it("throws on missing fleet id", () => {
    const fA = makeFleet({ id: "exists", nationId: "ATK", ships: [makeShip({ id: "s1" })] });
    const fD = makeFleet({ id: "def-f", nationId: "DEF", ships: [makeShip({ id: "s2" })] });
    const atk = makeNation("ATK", [fA]);
    const def = makeNation("DEF", [fD]);
    const battle: BattleInstance = {
      id: "battle-missing",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["does-not-exist"],
      defenderFleetIds: ["def-f"],
    };
    expect(() => resolver.resolve(battle, atk, def, new RandomEngine("seed"))).toThrow(
      BluewaveError,
    );
  });

  it("throws on empty fleet list", () => {
    const fD = makeFleet({ id: "def-f", nationId: "DEF", ships: [makeShip({ id: "s2" })] });
    const atk = makeNation("ATK", []);
    const def = makeNation("DEF", [fD]);
    const battle: BattleInstance = {
      id: "battle-empty",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: [],
      defenderFleetIds: ["def-f"],
    };
    expect(() => resolver.resolve(battle, atk, def, new RandomEngine("seed"))).toThrow(
      BluewaveError,
    );
  });

  it("isolates random stream per battle.id", () => {
    const shipsA = [makeShip({ id: "iso-a", firepower: SafeInt(10), armor: SafeInt(10) })];
    const shipsD = [makeShip({ id: "iso-d", firepower: SafeInt(10), armor: SafeInt(10) })];
    const fA = makeFleet({ id: "iso-fa", nationId: "ATK", ships: shipsA });
    const fD = makeFleet({ id: "iso-fd", nationId: "DEF", ships: shipsD });
    const atk = makeNation("ATK", [fA]);
    const def = makeNation("DEF", [fD]);
    const b1: BattleInstance = {
      id: "iso-1",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["iso-fa"],
      defenderFleetIds: ["iso-fd"],
    };
    const engine = new RandomEngine("iso-seed");
    const r1 = resolver.resolve(b1, cloneNation(atk), cloneNation(def), engine);
    const engine2 = new RandomEngine("iso-seed");
    const r1b = resolver.resolve(b1, cloneNation(atk), cloneNation(def), engine2);
    expect(r1.winnerId).toBe(r1b.winnerId);
    expect(r1.damageReport).toEqual(r1b.damageReport);
  });
});

describe("StrengthCalculator: a ship under rebuild does not count", () => {
  it("leaves unavailable ships out of firepower, as it leaves out ships under construction", () => {
    const ships = [
      makeShip({ id: "s1", firepower: SafeInt(10) }),
      makeShip({ id: "s2", firepower: SafeInt(20), availability: "UNAVAILABLE" }),
      makeShip({ id: "s3", firepower: SafeInt(40), isUnderConstruction: true }),
    ];
    expect(StrengthCalculator.totalFirepower(makeFleet({ id: "f", ships }))).toBe(10 as SafeInt);
  });
  it("a degraded ship still counts", () => {
    const ships = [makeShip({ id: "s1", firepower: SafeInt(10), availability: "DEGRADED" })];
    expect(StrengthCalculator.totalFirepower(makeFleet({ id: "f", ships }))).toBe(10 as SafeInt);
  });
});

describe("StrengthCalculator", () => {
  it("totalFirepower sums ship firepower", () => {
    const ships = [
      makeShip({ id: "s1", firepower: SafeInt(10) }),
      makeShip({ id: "s2", firepower: SafeInt(20) }),
      makeShip({ id: "s3", firepower: SafeInt(30) }),
    ];
    const fleet = makeFleet({ id: "f", ships });
    expect(StrengthCalculator.totalFirepower(fleet)).toBe(60 as SafeInt);
  });

  it("averageArmor computes correctly", () => {
    const ships = [
      makeShip({ id: "s1", armor: SafeInt(10) }),
      makeShip({ id: "s2", armor: SafeInt(20) }),
    ];
    const fleet = makeFleet({ id: "f", ships });
    expect(StrengthCalculator.averageArmor(fleet)).toBe(15 as SafeInt);
  });

  it("damagePotential uses firepower and armor", () => {
    const ships = [makeShip({ id: "s1", firepower: SafeInt(10), armor: SafeInt(20) })];
    const fleet = makeFleet({ id: "f", ships });
    const dp = StrengthCalculator.damagePotential(fleet);
    expect(dp).toBe(20);
  });

  it("survivability returns current/max HP as basis points", () => {
    const ships = [makeShip({ id: "s1", hitPoints: SafeInt(50), maxHitPoints: SafeInt(100) })];
    const fleet = makeFleet({ id: "f", ships });
    expect(StrengthCalculator.survivability(fleet)).toBe(BP_ONE / 2);
  });

  it("empty fleet => 0 for all", () => {
    const fleet = makeFleet({ id: "empty", ships: [] });
    expect(StrengthCalculator.totalFirepower(fleet)).toBe(0 as SafeInt);
    expect(StrengthCalculator.averageArmor(fleet)).toBe(0 as SafeInt);
    expect(StrengthCalculator.damagePotential(fleet)).toBe(0);
    expect(StrengthCalculator.survivability(fleet)).toBe(0);
    expect(StrengthCalculator.strength(fleet)).toBe(0);
    expect(StrengthCalculator.totalHitPoints(fleet)).toBe(0 as SafeInt);
  });

  it("filters isUnderConstruction", () => {
    const active = makeShip({
      id: "a1",
      firepower: SafeInt(100),
      armor: SafeInt(20),
      hitPoints: SafeInt(100),
      maxHitPoints: SafeInt(100),
      isUnderConstruction: false,
    });
    const building = makeShip({
      id: "b1",
      firepower: SafeInt(100),
      armor: SafeInt(20),
      hitPoints: SafeInt(100),
      maxHitPoints: SafeInt(100),
      isUnderConstruction: true,
    });
    const fleet = makeFleet({ id: "f", ships: [active, building] });
    expect(StrengthCalculator.totalFirepower(fleet)).toBe(100 as SafeInt);
    expect(StrengthCalculator.damagePotential(fleet)).toBe(200);
    expect(StrengthCalculator.survivability(fleet)).toBe(BP_ONE);
    expect(StrengthCalculator.strength(fleet)).toBe(200);
  });

  it("averageArmor float not trunc - 10 and 15 avg 12.5", () => {
    const s1 = makeShip({ id: "s1", firepower: SafeInt(10), armor: SafeInt(10) });
    const s2 = makeShip({ id: "s2", firepower: SafeInt(10), armor: SafeInt(15) });
    const fleet = makeFleet({ id: "f", ships: [s1, s2] });
    expect(StrengthCalculator.averageArmor(fleet)).toBe(13 as SafeInt);
    expect(StrengthCalculator.damagePotential(fleet)).toBe(25);
    expect(StrengthCalculator.strength(fleet)).toBe(25);
  });

  it("strength composes damagePotential and survivability exactly, rounding once", () => {
    const ships = [
      makeShip({
        id: "s1",
        firepower: SafeInt(1),
        armor: SafeInt(12),
        hitPoints: SafeInt(5),
        maxHitPoints: SafeInt(6),
      }),
    ];
    const fleet = makeFleet({ id: "f", ships });
    expect(StrengthCalculator.damagePotential(fleet)).toBe(1);
    expect(StrengthCalculator.survivability(fleet)).toBe(8333);
    expect(StrengthCalculator.strength(fleet)).toBe(1);
  });

  it("survivability capped at one whole and 0 when maxHp 0", () => {
    const over = makeShip({ id: "o", hitPoints: SafeInt(150), maxHitPoints: SafeInt(100) });
    expect(StrengthCalculator.survivability(makeFleet({ id: "f", ships: [over] }))).toBe(BP_ONE);
    expect(StrengthCalculator.strength(makeFleet({ id: "f", ships: [over] }))).toBe(10);
    const zero = makeShip({ id: "z", hitPoints: SafeInt(0), maxHitPoints: SafeInt(0) });
    expect(StrengthCalculator.survivability(makeFleet({ id: "f2", ships: [zero] }))).toBe(0);
    expect(StrengthCalculator.strength(makeFleet({ id: "f2", ships: [zero] }))).toBe(0);
  });

  it("1HP ship always sinks when overwhelming", () => {
    const resolver = new BattleResolver();
    const weak = [
      makeShip({
        id: "w1",
        hitPoints: SafeInt(1),
        maxHitPoints: SafeInt(1),
        firepower: SafeInt(1),
        armor: SafeInt(1),
      }),
    ];
    const strong = [
      makeShip({
        id: "s1",
        hitPoints: SafeInt(100),
        maxHitPoints: SafeInt(100),
        firepower: SafeInt(50),
        armor: SafeInt(20),
      }),
    ];
    const fWeak = makeFleet({ id: "fw", nationId: "DEF", ships: weak });
    const fStrong = makeFleet({ id: "fs", nationId: "ATK", ships: strong });
    const atk = makeNation("ATK", [fStrong]);
    const def = makeNation("DEF", [fWeak]);
    const battle: BattleInstance = {
      id: "sink-1hp",
      phase: "pending",
      attackerId: "ATK",
      defenderId: "DEF",
      areaId: "area-1",
      attackerFleetIds: ["fs"],
      defenderFleetIds: ["fw"],
    };
    const result = resolver.resolve(battle, atk, def, new RandomEngine("sink-seed"));
    expect(result.winnerId).toBe("ATK");
    expect(result.defenderLosses).toContain("w1");
    expect(result.damageReport["w1"]).toBe(1 as SafeInt);
  });
});
