import type { UnrestRules } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import {
  ATTACKER_NATION,
  CAMPAIGN_SEED,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
  makeShip,
} from "./battle-fixtures.js";

const RULES: UnrestRules = {
  sectionVersion: 1,
  referenceRateBp: 10_000,
  spendingStepBp: 10_000,
  spendingMaxRise: 0,
  spendingMaxCut: 0,
  warOutbreakRelief: 0,
  warDurationMonths: 240,
  warDurationRise: 0,
  blockadeRise: 0,
  defeatRise: 2,
  victoryRelief: 1,
  crampedWarRise: 0,
  crampedBlockadeRise: 0,
  strikeThreshold: 10,
  strikeRateStepBp: 250,
  revolutionThreshold: 10,
  revolutionProbabilityBp: 1,
  liberalDemocracyDampingBp: 4_000,
  aftermathUnrest: 5,
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [
      {
        title: "Rule the Waves 3 manual",
        author: "Naval War Simulations / Matrix Games",
        year: 2023,
        page: "62",
        section: "Unrest drivers and brakes",
      },
    ],
    note: "PROVISIONAL test fixture",
  },
};

describe("#996: battle results move unrest", () => {
  it("raises the loser's unrest and lowers the winner's", () => {
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
    const nations = new Map(base.nations);
    for (const id of [ATTACKER_NATION, DEFENDER_NATION]) {
      nations.set(id, { ...nations.get(id)!, unrest: 5 });
    }
    const result = new MonthExecutor().execute(
      { ...base, nations },
      [],
      CAMPAIGN_SEED,
      new DiagnosticCollector(),
      undefined,
      { playerNationId: ATTACKER_NATION, unrest: RULES },
    );
    const after = result.finalSnapshot.nations;
    const reasons = (id: string) =>
      after.get(id)?.unrestLastChange?.contributions.map((c) => c.reasonCode);
    const values = [after.get(ATTACKER_NATION)?.unrest, after.get(DEFENDER_NATION)?.unrest].sort();
    expect(values).toEqual([4, 7]);
    expect([reasons(ATTACKER_NATION), reasons(DEFENDER_NATION)].flat().sort()).toEqual([
      "DEFEAT",
      "VICTORY",
    ]);
  });
});
