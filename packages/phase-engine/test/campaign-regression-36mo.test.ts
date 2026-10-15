// campaign-regression-harness ticket 01 (ADR-0099): a fixed-seed 36-month
// campaign regression net.
//
// Drives the REAL `MonthExecutor` — the same entry point `turn:execute` and the
// desktop `commitMonth` use — for 36 months over a 2-nation war snapshot,
// generating and auto-resolving whatever battles it produces, and asserts:
//
//  - zero unhandled exceptions across the whole matrix;
//  - every produced battle resolves to a §32 end reason (nothing left pending);
//  - the ADR-0094 failure mode does not return: battles do not mostly grind to
//    the time-limit cap;
//  - invariants: ship hp stays in [0, max], total fleet hp never rises,
//    `turnNumber` advances one per month, treasuries stay finite;
//  - determinism: the same seed replays byte-identically (per-month ledger and
//    snapshot hashes); distinct seeds diverge.
//
// Cross-process determinism of the shared campaign path is covered by
// `@bluewave/cross-process-test` (determinism.yml); this harness adds the
// multi-month dimension in-process. It is a regression net, not gameplay: it
// asserts bands/invariants, never brittle exact outcomes.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { campaignMonthId, type CampaignSnapshot } from "@bluewave/campaign";
import { BATTLE_END_PRECEDENCE } from "@bluewave/combat";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "../src/month.js";
import { hashSnapshot } from "../src/replay.js";
import { makeBattleSnapshot } from "./battle-fixtures.js";

const MONTHS = 36;
const SEEDS = ["regression-a", "regression-b"] as const;
const REASONS: ReadonlySet<string> = new Set(BATTLE_END_PRECEDENCE);
const AUTO_RESOLVED = /^auto-resolved \(([a-z_]+)\) after \d+ battle minutes$/;
/** A battles-grind-to-the-cap regression is a time-limit share above this. */
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
  // Only the battles appended this month (the array accumulates across months).
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
    snapshotHash: hashSnapshot(final),
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
    // The engine does not advance turnNumber; feed the final snapshot back in
    // with turnNumber incremented so the calendar progresses (the desktop
    // commitMonth rule).
    snapshot = { ...final, turnNumber: SafeInt((final.turnNumber as number) + 1) };
  }
  return observations;
}

describe("campaign regression: fixed-seed 36-month loop", () => {
  // Cache per-seed runs so the invariants and divergence tests share one run
  // each instead of recomputing the 36-month loop. The determinism test still
  // runs fresh pairs. This keeps the harness cheap enough to run alongside the
  // rest of the package on a 2-core CI runner.
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
        // No battle may be left mid-flight when the month closes.
        expect(month.unresolved, `${seed} month ${String(index)} unresolved battles`).toBe(0);
        // Every recorded battle carries a valid §32 end reason.
        expect(month.badReasons, `${seed} month ${String(index)} battle end reasons`).toEqual([]);
        // Fleet hp is destroyed, never created: the total never rises.
        expect(month.totalHp).toBeLessThanOrEqual(previousHp);
        previousHp = month.totalHp;
        resolvedTotal += month.resolved;
        timeLimitBattles += month.reasons.filter((reason) => reason === "time_limit").length;
        battlesTotal += month.battlesThisMonth;
      });

      // The harness must actually exercise combat, not vacuously pass.
      expect(resolvedTotal, `${seed} resolved at least one battle`).toBeGreaterThan(0);
      expect(battlesTotal, `${seed} produced at least one battle`).toBeGreaterThan(0);
      // ADR-0094 regression guard: engagements must not mostly grind to the cap.
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
