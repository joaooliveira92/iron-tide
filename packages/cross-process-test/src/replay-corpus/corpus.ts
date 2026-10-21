import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { Result } from "effect";

import { compileProductionCampaign } from "../production-pack.js";
import { LEDGER_ORDER, fullSnapshotHash, ledgerEntryText, monthCheckpoint } from "./checkpoint.js";
import {
  REPLAY_FORMAT_VERSION,
  ReplayFileError,
  decodeReplayFile,
  type LedgerName,
  type ReplayFile,
} from "./format.js";

/** A command-free run of the committed production pack. */
export interface ReplayScenario {
  readonly id: string;
  readonly seed: string;
  readonly months: number;
}

/** The first place a re-execution stopped agreeing with the recorded replay. */
export interface ReplayDivergence {
  /** 1-based month index; 0 for a mismatch found before any month ran. */
  readonly month: number;
  readonly turnNumber: number;
  readonly where: "content" | "initial" | "snapshot" | LedgerName;
  /** Index of the first differing ledger entry; present only when `where` is a ledger. */
  readonly entryIndex?: number;
  /** Recorded hash, or `(missing)` when the recorded ledger is shorter. */
  readonly expected: string;
  /** Re-executed hash, or `(missing)` when the re-executed ledger is shorter. */
  readonly actual: string;
  /** Ledger lengths; present only when `where` is a ledger. */
  readonly expectedCount?: number;
  readonly actualCount?: number;
  /** Canonical text of the re-executed entry; absent when that ledger has no such entry. */
  readonly actualEntry?: string;
}

/**
 * Render a divergence as stable text: LF line endings, no paths, no timestamps,
 * so the same divergence prints identically on every OS.
 */
export function formatDivergence(d: ReplayDivergence): string {
  const entry = d.entryIndex === undefined ? "" : ` entry ${String(d.entryIndex)}`;
  const lines = [
    `month ${String(d.month)} (turn ${String(d.turnNumber)}) ${d.where}${entry}`,
    `  expected ${d.expected}`,
    `  actual   ${d.actual}`,
  ];
  if (d.expectedCount !== undefined && d.actualCount !== undefined) {
    lines.push(
      `  ledger length expected ${String(d.expectedCount)}, actual ${String(d.actualCount)}`,
    );
  }
  if (d.actualEntry !== undefined) lines.push(`  actual entry ${d.actualEntry}`);
  return `${lines.join("\n")}\n`;
}

export type VerifyOutcome =
  | { readonly ok: true; readonly months: number }
  | { readonly ok: false; readonly divergence: ReplayDivergence };

const PACK = "1880";

let productionCampaign: ReturnType<typeof compileProductionCampaign> | undefined;
function production(): ReturnType<typeof compileProductionCampaign> {
  productionCampaign ??= compileProductionCampaign();
  return productionCampaign;
}

function monthSeed(seed: string, snapshot: CampaignSnapshot): string {
  return `${seed}:month:${String(snapshot.turnNumber)}`;
}

function advance(snapshot: CampaignSnapshot, seed: string) {
  const result = new MonthExecutor().execute(
    snapshot,
    [],
    monthSeed(seed, snapshot),
    new DiagnosticCollector(),
  );
  if (result.outcome === "suspended") {
    throw new Error(
      `Month ${String(snapshot.turnNumber)} suspended for an interruption; replay format v${String(REPLAY_FORMAT_VERSION)} cannot record it`,
    );
  }
  return {
    result,
    next: {
      ...result.finalSnapshot,
      turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
    },
  };
}

/** Record `scenario` through the real engine into canonical replay-file text. */
export function recordReplay(scenario: ReplayScenario): string {
  const { state, contentHash } = production();
  let snapshot = state.snapshot;
  const months: ReplayFile["months"][number][] = [];
  for (let index = 0; index < scenario.months; index++) {
    const step = advance(snapshot, scenario.seed);
    months.push(monthCheckpoint(Number(snapshot.turnNumber), step.result));
    snapshot = step.next;
  }
  const file: ReplayFile = {
    formatVersion: REPLAY_FORMAT_VERSION,
    scenarioId: scenario.id,
    rulesetVersion: state.snapshot.rulesetVersion,
    compatibilityVersion: state.snapshot.compatibilityVersion,
    seed: scenario.seed,
    contentHash,
    initial: {
      kind: "production-pack",
      pack: PACK,
      snapshotHash: fullSnapshotHash(state.snapshot),
    },
    engineOptions: { kind: "default" },
    months,
  };
  return `${canonicalSerialize(file)}\n`;
}

function firstLedgerDifference(
  expected: readonly string[],
  actual: readonly string[],
): { entryIndex: number; expected: string; actual: string } | undefined {
  const length = Math.max(expected.length, actual.length);
  for (let entryIndex = 0; entryIndex < length; entryIndex++) {
    if (expected[entryIndex] !== actual[entryIndex]) {
      return {
        entryIndex,
        expected: expected[entryIndex] ?? "(missing)",
        actual: actual[entryIndex] ?? "(missing)",
      };
    }
  }
  return undefined;
}

/**
 * Re-execute a replay file through the real engine, checking each month against
 * its recorded checkpoint. A file that cannot be decoded fails with `ReplayFileError`.
 */
export function verifyReplay(text: string): Result.Result<VerifyOutcome, ReplayFileError> {
  const decoded = decodeReplayFile(text);
  if (Result.isFailure(decoded)) return Result.fail(decoded.failure);
  const file = decoded.success;
  const { state, contentHash } = production();
  const fail = (divergence: ReplayDivergence) =>
    Result.succeed<VerifyOutcome>({ ok: false, divergence });

  if (contentHash !== file.contentHash) {
    return fail({
      month: 0,
      turnNumber: 0,
      where: "content",
      expected: file.contentHash,
      actual: contentHash,
    });
  }
  let snapshot = state.snapshot;
  const initialHash = fullSnapshotHash(snapshot);
  if (initialHash !== file.initial.snapshotHash) {
    return fail({
      month: 0,
      turnNumber: 0,
      where: "initial",
      expected: file.initial.snapshotHash,
      actual: initialHash,
    });
  }
  for (const [index, recorded] of file.months.entries()) {
    const month = index + 1;
    const step = advance(snapshot, file.seed);
    const actual = monthCheckpoint(Number(snapshot.turnNumber), step.result);
    for (const ledger of LEDGER_ORDER) {
      const difference = firstLedgerDifference(
        recorded.ledgers[ledger].entryHashes,
        actual.ledgers[ledger].entryHashes,
      );
      if (difference !== undefined) {
        const actualEntry = ledgerEntryText(step.result, ledger, difference.entryIndex);
        return fail({
          month,
          turnNumber: actual.turnNumber,
          where: ledger,
          ...difference,
          expectedCount: recorded.ledgers[ledger].count,
          actualCount: actual.ledgers[ledger].count,
          ...(actualEntry === undefined ? {} : { actualEntry }),
        });
      }
    }
    if (actual.snapshotHash !== recorded.snapshotHash) {
      return fail({
        month,
        turnNumber: actual.turnNumber,
        where: "snapshot",
        expected: recorded.snapshotHash,
        actual: actual.snapshotHash,
      });
    }
    snapshot = step.next;
  }
  return Result.succeed<VerifyOutcome>({ ok: true, months: file.months.length });
}
