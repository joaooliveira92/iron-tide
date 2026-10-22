import type { CampaignSnapshot, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { applyBattleConsequences, collectLostShips, MonthExecutor } from "../src/index.js";
import {
  ATTACKER_NATION,
  CAMPAIGN_SEED,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
  makeShip,
} from "./battle-fixtures.js";

function battleShip(id: string, nationId: string, inBattleId?: string): Ship {
  return makeShip(id, "", nationId, { firepower: 100, inBattleId });
}

function allShips(snapshot: CampaignSnapshot): Ship[] {
  return [...snapshot.nations.values()].flatMap((n) => n.fleets.flatMap((f) => f.ships));
}

describe("battle consequences (AC-9)", () => {
  it("applies per-ship damage clamped >= 0 and removes terminal ships (sunk list OR derived hp == 0)", () => {
    const snapshot = makeBattleSnapshot({
      attackerShips: [
        battleShip("g1", ATTACKER_NATION, "battle-1"),
        battleShip("g2", ATTACKER_NATION, "battle-1"),
      ],
      defenderShips: [
        battleShip("f1", DEFENDER_NATION, "battle-1"),
        battleShip("f2", DEFENDER_NATION, "battle-1"),
      ],
    });
    const battle = makeBattle();

    const next = applyBattleConsequences(snapshot, battle, {
      damageReport: {
        g1: SafeInt(9_999),
        g2: SafeInt(0),
        f1: SafeInt(100),
        f2: SafeInt(60),
      },
      attackerSunkIds: [],
      defenderSunkIds: ["f1"],
    });

    const remaining = allShips(next)
      .map((s) => s.id)
      .sort();
    expect(remaining).toEqual(["f2", "g2"]);
    const g2 = allShips(next).find((s) => s.id === "g2")!;
    const f2 = allShips(next).find((s) => s.id === "f2")!;
    expect(g2.hitPoints).toBe(SafeInt(100));
    expect(f2.hitPoints).toBe(SafeInt(40));
    for (const ship of allShips(next)) expect(ship.inBattleId).toBeUndefined();
    expect(next.nations).not.toBe(snapshot.nations);
  });

  it("removal is deterministic and order-preserving (canonical fleet order)", () => {
    const snapshot = makeBattleSnapshot({
      attackerShips: [
        battleShip("g1", ATTACKER_NATION, "battle-1"),
        battleShip("g2", ATTACKER_NATION, "battle-1"),
      ],
      defenderShips: [
        battleShip("f1", DEFENDER_NATION, "battle-1"),
        battleShip("f2", DEFENDER_NATION, "battle-1"),
      ],
    });
    const battle = makeBattle();
    const result = {
      damageReport: { g1: SafeInt(100), g2: SafeInt(10), f1: SafeInt(100), f2: SafeInt(0) },
      attackerSunkIds: ["g1"],
      defenderSunkIds: ["f1"],
    };

    const a = applyBattleConsequences(snapshot, battle, result);
    const b = applyBattleConsequences(snapshot, battle, result);
    expect(allShips(a).map((s) => s.id)).toEqual(allShips(b).map((s) => s.id));
    expect(sha256Hex(canonicalSerialize(a))).toBe(sha256Hex(canonicalSerialize(b)));
    const gbr = a.nations.get(ATTACKER_NATION)!;
    expect(gbr.fleets[0]!.ships.map((s) => s.id)).toEqual(["g2"]);
    const fra = a.nations.get(DEFENDER_NATION)!;
    expect(fra.fleets[0]!.ships.map((s) => s.id)).toEqual(["f2"]);
  });

  it("phase-level: a decided tactical battle applies real damage, removes sunk ships, clears reservations, and two identical runs are byte-identical", () => {
    const run = () => {
      const collector = new DiagnosticCollector();
      const result = new MonthExecutor().execute(
        makeBattleSnapshot(),
        [],
        CAMPAIGN_SEED,
        collector,
      );
      return { collector, result };
    };
    const a = run();
    const b = run();

    const battle = a.result.finalSnapshot.wars.battles[0]!;
    expect(battle.phase).toBe("resolved");
    const result = battle.result!;
    expect(result.winnerId).toBeTruthy();
    expect(result.loserId).toBeTruthy();

    const pristine = makeBattleSnapshot();
    const pristineById = new Map<string, Ship>();
    for (const n of pristine.nations.values())
      for (const f of n.fleets) for (const s of f.ships) pristineById.set(s.id, s);

    const sunk = new Set<string>([...result.attackerLosses, ...result.defenderLosses]);
    for (const ship of allShips(a.result.finalSnapshot)) {
      expect(sunk.has(ship.id)).toBe(false);
      const startHp = pristineById.get(ship.id)!.hitPoints as number;
      const loss = Number(result.damageReport[ship.id] ?? 0);
      expect(ship.hitPoints).toBe(SafeInt(Math.max(0, startHp - loss)));
      expect(ship.inBattleId).toBeUndefined();
    }
    const present = new Set(allShips(a.result.finalSnapshot).map((s) => s.id));
    for (const id of sunk) {
      expect(pristineById.get(id)).toBeDefined();
      expect(present.has(id)).toBe(false);
    }

    expect(sha256Hex(canonicalSerialize(a.result.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(b.result.finalSnapshot)),
    );
    expect(a.result.randomLedger.hash()).toBe(b.result.randomLedger.hash());
  });
});

describe("collectLostShips (ADR-0061)", () => {
  it("records name, class, nation, month and cause for exactly the ships applyBattleConsequences removes", () => {
    const snapshot = makeBattleSnapshot({
      attackerShips: [
        battleShip("g1", ATTACKER_NATION, "battle-1"),
        battleShip("g2", ATTACKER_NATION, "battle-1"),
      ],
      defenderShips: [
        battleShip("f1", DEFENDER_NATION, "battle-1"),
        battleShip("f2", DEFENDER_NATION, "battle-1"),
      ],
    });
    const battle = makeBattle();
    const result = {
      damageReport: { g1: SafeInt(9_999), g2: SafeInt(0), f1: SafeInt(100), f2: SafeInt(60) },
      attackerSunkIds: [],
      defenderSunkIds: ["f1"],
      causeOfLoss: { f1: "torpedo" as const },
    };
    const lost = collectLostShips(snapshot, battle, result, "1880-03");
    const after = allShips(applyBattleConsequences(snapshot, battle, result)).map((x) => x.id);
    const before = allShips(snapshot).map((x) => x.id);
    expect(lost.map((l) => l.shipId).sort()).toEqual(
      before.filter((id) => !after.includes(id)).sort(),
    );
    const f1 = lost.find((l) => l.shipId === "f1")!;
    expect(f1).toMatchObject({ nationId: DEFENDER_NATION, month: "1880-03", cause: "torpedo" });
    expect(f1.name.length).toBeGreaterThan(0);
    expect(lost.find((l) => l.shipId === "g1")!.cause).toBeUndefined();
  });
});
