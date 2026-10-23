import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, monthPipeline, type MonthResult } from "../src/index.js";
import {
  ATTACKER_NATION,
  CAMPAIGN_SEED,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
  makeShip,
} from "./battle-fixtures.js";

function withState(
  snapshot: CampaignSnapshot,
  prestige: Record<string, number>,
  probabilityBp: number,
): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  for (const [id, value] of Object.entries(prestige)) {
    nations.set(id, { ...nations.get(id)!, prestige: SafeInt(value) });
  }
  return {
    ...snapshot,
    nations,
    prestigeRules: { ...snapshot.prestigeRules, sackingProbabilityBp: SafeInt(probabilityBp) },
  };
}

const quiet = (): CampaignSnapshot => makeBattleSnapshot({ wars: [], battles: [] });

function run(snapshot: CampaignSnapshot, player?: string): MonthResult {
  return new MonthExecutor().execute(
    snapshot,
    [],
    CAMPAIGN_SEED,
    new DiagnosticCollector(),
    undefined,
    player === undefined ? undefined : { playerNationId: player },
  );
}

const sackingDraws = (result: MonthResult) =>
  result.randomLedger.all.filter((d) => d.streamId === "prestige_sacking");

describe("S-2 06: the sacking phase", () => {
  it("is registered after battle resolution and before closing validation", () => {
    const ids = monthPipeline.phaseIds;
    expect(ids.indexOf("sacking")).toBeGreaterThan(ids.indexOf("battle_resolution"));
    expect(ids.indexOf("sacking")).toBe(ids.indexOf("closing_validation") - 1);
  });

  it("makes no draw above the threshold", () => {
    const result = run(withState(quiet(), { [ATTACKER_NATION]: 11 }, 10_000), ATTACKER_NATION);
    expect(sackingDraws(result)).toHaveLength(0);
    expect(result.finalSnapshot.careerResult).toBeUndefined();
  });

  it("records one full draw at the threshold and sacks when the draw falls under the probability", () => {
    const result = run(withState(quiet(), { [ATTACKER_NATION]: 10 }, 10_000), ATTACKER_NATION);
    const draws = sackingDraws(result);
    expect(draws).toHaveLength(1);
    const month = "1880-02";
    expect(draws[0]).toMatchObject({
      streamId: "prestige_sacking",
      entityKey: `${ATTACKER_NATION}/${month}`,
      phase: "sacking",
      rulesetVersion: result.finalSnapshot.rulesetVersion,
      outcome: "SACKED",
      reasonCode: "SACKED",
    });
    expect(draws[0]!.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(draws[0]!.draw).toBeGreaterThanOrEqual(0);
    expect(draws[0]!.draw).toBeLessThan(10_000);
    expect(result.finalSnapshot.careerResult).toEqual({
      nationId: ATTACKER_NATION,
      score: 10,
      reason: "SACKED",
      month: { year: 1880, month: 2 },
    });
  });

  it("records the draw but keeps the career when the draw misses", () => {
    const result = run(withState(quiet(), { [ATTACKER_NATION]: 10 }, 0), ATTACKER_NATION);
    expect(sackingDraws(result)).toHaveLength(1);
    expect(sackingDraws(result)[0]).toMatchObject({ outcome: "RETAINED", reasonCode: "RETAINED" });
    expect(result.finalSnapshot.careerResult).toBeUndefined();
  });

  it("evaluates only the player nation", () => {
    const snapshot = withState(quiet(), { [DEFENDER_NATION]: 3 }, 10_000);
    expect(sackingDraws(run(snapshot, ATTACKER_NATION))).toHaveLength(0);
    expect(sackingDraws(run(snapshot))).toHaveLength(0);
  });

  it("counts a same-month battle loss before the check", () => {
    const base = makeBattleSnapshot({
      attackerShips: [
        makeShip("g1", "", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
        makeShip("g2", "", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
      ],
      defenderShips: [
        makeShip("f1", "", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
        makeShip("f2", "", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
      ],
      designs: new Map(),
      battles: [makeBattle({ id: "battle-m1" })],
      manifests: [],
    });
    const result = run(withState(base, { [ATTACKER_NATION]: 11 }, 10_000), ATTACKER_NATION);
    expect(result.finalSnapshot.careerResult).toMatchObject({ score: 10, reason: "SACKED" });
    const kinds = result.eventLedger.all.map((e) => e.body.kind);
    expect(kinds).toContain("PrestigeChanged");
  });

  it("is deterministic for the same seed and state", () => {
    const snapshot = withState(quiet(), { [ATTACKER_NATION]: 5 }, 5_000);
    const a = run(snapshot, ATTACKER_NATION);
    const b = run(snapshot, ATTACKER_NATION);
    expect(a.randomLedger.hash()).toBe(b.randomLedger.hash());
    expect(a.finalSnapshot.careerResult).toEqual(b.finalSnapshot.careerResult);
  });

  it("refuses further months once sacked, leaving the snapshot untouched", () => {
    const first = run(withState(quiet(), { [ATTACKER_NATION]: 10 }, 10_000), ATTACKER_NATION);
    const sacked = first.finalSnapshot;
    const again = run(sacked, ATTACKER_NATION);
    expect(again.outcome).toBe("career_ended");
    expect(again.success).toBe(false);
    expect(again.finalSnapshot).toBe(sacked);
    expect(again.randomLedger.all).toHaveLength(0);
    expect(again.eventLedger.all).toHaveLength(0);
    expect(again.finalSnapshot.turnNumber).toBe(sacked.turnNumber);
  });
});
