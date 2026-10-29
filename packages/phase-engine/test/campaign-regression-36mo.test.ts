import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { campaignMonthId, type CampaignSnapshot } from "@bluewave/campaign";
import { BATTLE_END_PRECEDENCE } from "@bluewave/combat/battleResolution";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "../src/month.js";
import { unifiedSnapshotHash } from "../src/index.js";
import { makeBattleSnapshot } from "./battle-fixtures.js";

const MONTHS = 36;
const SEEDS = ["regression-a", "regression-b"] as const;
const REASONS: ReadonlySet<string> = new Set(BATTLE_END_PRECEDENCE);
const AUTO_RESOLVED = /^auto-resolved \(([a-z_]+)\) after \d+ battle minutes$/;
const TIME_LIMIT_SHARE_MAX = 0.5;

interface MonthObservation {
  turn: number;
  month: string;
  success: boolean;
  eventHash: string;
  randomHash: string;
  commandHash: string;
  financialHash: string;
  snapshotHash: string;
  battlesThisMonth: number;
  resolved: number;
  unresolved: number;
  badReasons: string[];
  reasons: string[];
  negativeHp: boolean;
  overMaxHp: boolean;
  totalHp: number;
  totalShips: number;
  treasuryFinite: boolean;
}

function campaignMonthOf(snapshot: CampaignSnapshot): string {
  return campaignMonthId(
    snapshot.startYear as number,
    snapshot.startMonth as number,
    snapshot.turnNumber as number,
  );
}

function observe(
  final: CampaignSnapshot,
  ledgers: {
    eventHash: string;
    randomHash: string;
    commandHash: string;
    financialHash: string;
  },
  success: boolean,
  sinceIndex: number,
): MonthObservation {
  let resolved = 0;
  let unresolved = 0;
  let totalShips = 0;
  let totalHp = 0;
  let negativeHp = false;
  let overMaxHp = false;
  let treasuryFinite = true;
  for (const nation of final.nations.values()) {
    for (const fleet of nation.fleets) {
      for (const ship of fleet.ships) {
        const hp = ship.hitPoints as number;
        const max = ship.maxHitPoints as number;
        totalShips += 1;
        totalHp += hp;
        if (!Number.isFinite(hp) || hp < 0) negativeHp = true;
        if (hp > max) overMaxHp = true;
      }
    }
    if (!Number.isFinite(nation.treasury as number)) treasuryFinite = false;
  }
  const badReasons: string[] = [];
  const reasons: string[] = [];
  const thisMonth = final.wars.battles.slice(sinceIndex);
  for (const battle of thisMonth) {
    if (battle.phase === "resolved") {
      resolved += 1;
      const heading = battle.result?.explanation[0] ?? "";
      const reason = AUTO_RESOLVED.exec(heading)?.[1];
      if (reason === undefined || !REASONS.has(reason)) badReasons.push(heading);
      else reasons.push(reason);
    } else {
      unresolved += 1;
    }
  }
  return {
    turn: final.turnNumber as number,
    month: campaignMonthOf(final),
    success,
    eventHash: ledgers.eventHash,
    randomHash: ledgers.randomHash,
    commandHash: ledgers.commandHash,
    financialHash: ledgers.financialHash,
    snapshotHash: unifiedSnapshotHash(final),
    battlesThisMonth: thisMonth.length,
    resolved,
    unresolved,
    badReasons,
    reasons,
    negativeHp,
    overMaxHp,
    totalHp,
    totalShips,
    treasuryFinite,
  };
}

function run36(seed: string): MonthObservation[] {
  let snapshot = makeBattleSnapshot({ turnNumber: SafeInt(0) });
  const observations: MonthObservation[] = [];
  for (let m = 0; m < MONTHS; m++) {
    const sinceIndex = snapshot.wars.battles.length;
    const result = new MonthExecutor().execute(
      snapshot,
      [],
      `${seed}:month:${String(m)}`,
      new DiagnosticCollector(),
    );
    const final = result.finalSnapshot;
    observations.push(
      observe(
        final,
        {
          eventHash: result.eventLedger.hash(),
          randomHash: result.randomLedger.hash(),
          commandHash: result.commandLedger.hash(),
          financialHash: result.financialLedger.hash(),
        },
        result.success,
        sinceIndex,
      ),
    );
    snapshot = { ...final, turnNumber: SafeInt((final.turnNumber as number) + 1) };
  }
  return observations;
}

describe("campaign regression: fixed-seed 36-month loop", () => {
  const runs = new Map<string, MonthObservation[]>();
  const runCached = (seed: string): MonthObservation[] => {
    let run = runs.get(seed);
    if (run === undefined) {
      run = run36(seed);
      runs.set(seed, run);
    }
    return run;
  };

  it("runs 36 months for every seed with no exception and holds the invariants", () => {
    for (const seed of SEEDS) {
      const run = runCached(seed);
      expect(run).toHaveLength(MONTHS);

      let previousHp = Number.POSITIVE_INFINITY;
      let resolvedTotal = 0;
      let timeLimitBattles = 0;
      let battlesTotal = 0;
      run.forEach((month, index) => {
        expect(month.success, `${seed} month ${String(index)} success`).toBe(true);
        expect(month.turn, `${seed} month ${String(index)} turn`).toBe(index);
        expect(month.negativeHp, `${seed} month ${String(index)} negative hp`).toBe(false);
        expect(month.overMaxHp, `${seed} month ${String(index)} hp above max`).toBe(false);
        expect(month.treasuryFinite, `${seed} month ${String(index)} treasury`).toBe(true);
        expect(month.unresolved, `${seed} month ${String(index)} unresolved battles`).toBe(0);
        expect(month.badReasons, `${seed} month ${String(index)} battle end reasons`).toEqual([]);
        expect(month.totalHp).toBeLessThanOrEqual(previousHp);
        previousHp = month.totalHp;
        resolvedTotal += month.resolved;
        timeLimitBattles += month.reasons.filter((reason) => reason === "time_limit").length;
        battlesTotal += month.battlesThisMonth;
      });

      expect(resolvedTotal, `${seed} resolved at least one battle`).toBeGreaterThan(0);
      expect(battlesTotal, `${seed} produced at least one battle`).toBeGreaterThan(0);
      expect(timeLimitBattles / battlesTotal, `${seed} time_limit share`).toBeLessThanOrEqual(
        TIME_LIMIT_SHARE_MAX,
      );
    }
  }, 180_000);

  it("is deterministic: the same seed replays byte-identically", () => {
    const seed = SEEDS[0];
    const a = run36(seed);
    const b = run36(seed);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  }, 180_000);

  it("diverges across seeds (the seed actually steers the run)", () => {
    const a = runCached(SEEDS[0]);
    const b = runCached(SEEDS[1]);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  }, 180_000);
});
