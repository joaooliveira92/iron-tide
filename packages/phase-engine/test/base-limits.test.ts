// S-5 08 (#82, spec #73 R10/R11/R13): the month-end base-limit step. Ships beyond the area's limit are flagged and suffer the
// S-1 consequences only after the month's battles; the flag clears the month after the fleet is back within the limit.
// EVERY RULESET NUMBER BELOW IS FIXTURE-CLASS: it exercises the mechanics and is never a production value (R11, R14).
import {
  nationMonthlyMaintenance,
  type CampaignSnapshot,
  type WorldState,
  type Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import {
  ATTACKER_NATION,
  BATTLE_AREA,
  CAMPAIGN_SEED,
  DEFENDER_NATION,
  makeBattleSnapshot,
  makeShip,
} from "./battle-fixtures.js";

const FIXTURE_PRESENCE = {
  colonialServiceDisplacementBp: 137,
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

const FIXTURE_BASE_LIMITS = {
  limitByBaseLevel: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => n * 2),
  noBaseLimit: 1,
  occupyingStates: ["ACTIVE", "RESERVE"] as const,
  maintenanceAdderBp: 5_000,
  crewQualityReduction: 25,
};

function run(from: CampaignSnapshot, baseLimits: boolean, presence = true) {
  return new MonthExecutor().execute(
    from,
    [],
    CAMPAIGN_SEED,
    new DiagnosticCollector(),
    undefined,
    presence
      ? {
          presence: {
            ...FIXTURE_PRESENCE,
            ...(baseLimits ? { baseLimits: FIXTURE_BASE_LIMITS } : {}),
          },
        }
      : undefined,
  );
}

const hash = (r: { finalSnapshot: CampaignSnapshot }) =>
  sha256Hex(canonicalSerialize(r.finalSnapshot));

type PortData = WorldState["ports"][number];

const port = (level: number, areaId = BATTLE_AREA, nationId = ATTACKER_NATION): PortData => ({
  id: `port-${nationId}-${areaId}`,
  name: "port",
  areaId,
  nationId,
  level: SafeInt(level),
});

/** Peace, GBR with `count` ships in a-1, optional ports. */
function peace(count: number, ports: PortData[] = [], loc = BATTLE_AREA): CampaignSnapshot {
  const ships = Array.from({ length: count }, (_, i) =>
    makeShip(`g${i + 1}`, "dv-att-a", ATTACKER_NATION, { loc }),
  );
  const base = makeBattleSnapshot({ attackerShips: ships, wars: [] });
  return { ...base, world: { ...base.world, ports } };
}

const gbrShips = (r: { finalSnapshot: CampaignSnapshot }): Ship[] =>
  r.finalSnapshot.nations.get(ATTACKER_NATION)!.fleets.flatMap((f) => f.ships);

describe("S-5 08: base limits at month end", () => {
  it("flags the ships beyond a small-base area's limit and applies the S-1 crew consequence", () => {
    // level 1 port -> limit 2; four ships deployed.
    const ships = gbrShips(run(peace(4, [port(1)]), true));
    expect(
      ships.map((s) => [s.id, s.overBase?.maintenanceAdderBp ?? null, Number(s.crewQuality)]),
    ).toEqual([
      ["g1", null, 100],
      ["g2", null, 100],
      ["g3", 5_000, 75],
      ["g4", 5_000, 75],
    ]);
  });

  it("flags nothing at or below the limit", () => {
    expect(gbrShips(run(peace(2, [port(1)]), true)).some((s) => s.overBase !== undefined)).toBe(
      false,
    );
  });

  it("applies the no-base limit where the nation has no port in the area", () => {
    const ships = gbrShips(run(peace(3, []), true));
    expect(ships.filter((s) => s.overBase !== undefined).map((s) => s.id)).toEqual(["g2", "g3"]);
  });

  it("a fleet fights in an over-base area the month it arrives: the battle is identical and ships suffer afterwards", () => {
    // Default fixture: GBR and FRA each field two armed ships in a-1 at war, so a battle runs this month. No ports -> limit 1.
    const from = makeBattleSnapshot();
    const without = run(from, false);
    const withLimits = run(from, true);
    expect(withLimits.finalSnapshot.wars.battles).toEqual(without.finalSnapshot.wars.battles);
    expect(withLimits.finalSnapshot.wars.battles.some((b) => b.result !== undefined)).toBe(true);
    // The consequences land on the battle's survivors only after it.
    for (const nationId of [ATTACKER_NATION, DEFENDER_NATION]) {
      const survivors = (r: typeof without) =>
        r.finalSnapshot.nations.get(nationId)!.fleets.flatMap((f) => f.ships);
      const before = survivors(without);
      const after = survivors(withLimits);
      expect(after.map((s) => s.id)).toEqual(before.map((s) => s.id));
      const flagged = after.filter((s) => s.overBase !== undefined);
      expect(flagged.length).toBe(Math.max(0, after.length - 1));
      for (const s of flagged) {
        const was = before.find((b) => b.id === s.id)!;
        expect(Number(s.crewQuality)).toBe(Math.max(0, Number(was.crewQuality) - 25));
      }
    }
  });

  it("is not exempted by a war with a blockade (ADR-0248)", () => {
    const base = peace(3, [port(1)]);
    const blockaded: CampaignSnapshot = {
      ...base,
      wars: {
        ...base.wars,
        wars: [
          {
            id: "w",
            attackerSideId: "a",
            defenderSideId: "d",
            attackerSideMembers: [DEFENDER_NATION],
            defenderSideMembers: [ATTACKER_NATION],
            attackerWarScore: 0,
            defenderWarScore: 0,
            attackerId: DEFENDER_NATION,
            defenderId: ATTACKER_NATION,
            startDate: "1880-01",
            status: "ACTIVE",
          },
        ],
        blockadeState: [
          {
            blockaderId: DEFENDER_NATION,
            blockadedNationId: ATTACKER_NATION,
            areaId: BATTLE_AREA,
            establishedMonth: "1880-01",
          },
        ],
      },
    };
    expect(gbrShips(run(blockaded, true)).filter((s) => s.overBase !== undefined)).toHaveLength(1);
  });

  it("charges the maintenance adder through the S-1 seam from the next month and clears the flag once back within the limit", () => {
    const first = run(peace(4, [port(1), port(5, "a-2")]), true);
    const flagged = gbrShips(first).filter((s) => s.overBase !== undefined);
    expect(flagged).toHaveLength(2);
    const fleets = first.finalSnapshot.nations.get(ATTACKER_NATION)!.fleets;
    const plain = fleets.map((f) => ({
      ships: f.ships.map(({ hitPoints, readiness }) => ({ hitPoints, readiness })),
    }));
    expect(Number(nationMonthlyMaintenance(fleets, false))).toBeGreaterThan(
      Number(nationMonthlyMaintenance(plain, false)),
    );

    // The fleet returns: the flagged ships move to a-2 (limit 10). The next month check clears flags and keeps ramp recovery.
    const nations = new Map(first.finalSnapshot.nations);
    const gbr = nations.get(ATTACKER_NATION)!;
    nations.set(ATTACKER_NATION, {
      ...gbr,
      fleets: gbr.fleets.map((f) => ({
        ...f,
        ships: f.ships.map((s) => (s.overBase === undefined ? s : { ...s, locationAreaId: "a-2" })),
      })),
    });
    const second = run({ ...first.finalSnapshot, nations }, true);
    expect(gbrShips(second).some((s) => s.overBase !== undefined)).toBe(false);
  });

  it("stays flagged and keeps reducing while the fleet stays over the limit", () => {
    const second = run(run(peace(3, [port(1)]), true).finalSnapshot, true);
    const g3 = gbrShips(second).find((s) => s.id === "g3")!;
    expect(g3.overBase).toBeDefined();
    // 100 - 25 at month 1, +5 ramp, -25 at month 2.
    expect(Number(g3.crewQuality)).toBe(55);
  });

  it("is dormant without the block: no flag, and the final hash equals the run without the presence section", () => {
    const from = peace(5, []);
    expect(gbrShips(run(from, false)).some((s) => s.overBase !== undefined)).toBe(false);
    expect(hash(run(from, false))).toBe(hash(run(from, false, false)));
  });

  it("is deterministic", () => {
    expect(hash(run(peace(5, [port(1)]), true))).toBe(hash(run(peace(5, [port(1)]), true)));
  });
});
