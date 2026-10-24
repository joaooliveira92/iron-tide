import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore, restampState } from "@bluewave/persistence";
import { MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { Effect, Result } from "effect";

import { compileProductionCampaign } from "../production-pack.js";
import { LEDGER_ORDER, fullSnapshotHash, ledgerEntryText, monthCheckpoint } from "./checkpoint.js";
import {
  REPLAY_FORMAT_VERSION,
  ReplayFileError,
  decodeReplayFile,
  type LedgerName,
  type ReplayFile,
} from "./format.js";

export interface ReplayScenario {
  readonly id: string;
  readonly seed: string;
  readonly months: number;
}

export interface ReplayDivergence {
  readonly month: number;
  readonly turnNumber: number;
  readonly where: "content" | "initial" | "snapshot" | "roundtrip" | LedgerName;
  readonly entryIndex?: number;
  readonly expected: string;
  readonly actual: string;
  readonly expectedCount?: number;
  readonly actualCount?: number;
  readonly actualEntry?: string;
}

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

export function productionStartSnapshot(): CampaignSnapshot {
  return production().state.snapshot;
}

function monthSeed(seed: string, snapshot: CampaignSnapshot): string {
  return `${seed}:month:${String(snapshot.turnNumber)}`;
}

export interface ExecutorPerturbation {
  readonly month: number;
  readonly snapshot?: (snapshot: CampaignSnapshot) => CampaignSnapshot;
  readonly seed?: (seed: string) => string;
  readonly commands?: (snapshot: CampaignSnapshot) => CommandEnvelope<CommandBody>[];
  readonly afterExecute?: (result: MonthResult) => void;
}

export interface RoundTripOptions {
  readonly lossy?: (snapshot: CampaignSnapshot, month: number) => CampaignSnapshot;
}

export interface VerifyOptions {
  readonly perturb?: ExecutorPerturbation;
  readonly roundTrip?: RoundTripOptions;
}

export type RoundTrip =
  | { readonly ok: true; readonly snapshot: CampaignSnapshot }
  | { readonly ok: false; readonly reason: string };

export function saveAndLoad(snapshot: CampaignSnapshot): RoundTrip {
  const saveDir = mkdtempSync(join(tmpdir(), "bw-replay-roundtrip-"));
  try {
    const store = new SaveStore();
    const state = restampState(
      { snapshot, envelope: undefined as never, rawHash: "" },
      snapshot.compatibilityVersion,
    );
    store.save(state, saveDir);
    const loaded = Effect.runSync(Effect.result(store.load(saveDir)));
    if (Result.isFailure(loaded)) {
      return { ok: false, reason: loaded.failure.message };
    }
    return { ok: true, snapshot: loaded.success.state.snapshot };
  } finally {
    rmSync(saveDir, { recursive: true, force: true });
  }
}

export function advance(
  snapshot: CampaignSnapshot,
  seed: string,
  perturb?: Omit<ExecutorPerturbation, "month">,
) {
  const result = new MonthExecutor().execute(
    perturb?.snapshot?.(snapshot) ?? snapshot,
    perturb?.commands?.(snapshot) ?? [],
    perturb?.seed?.(monthSeed(seed, snapshot)) ?? monthSeed(seed, snapshot),
    new DiagnosticCollector(),
  );
  perturb?.afterExecute?.(result);
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

export interface ExecutedMonth {
  readonly turnNumber: number;
  readonly result: MonthResult;
}

export function* executeScenario(scenario: ReplayScenario): Generator<ExecutedMonth> {
  let snapshot = production().state.snapshot;
  for (let index = 0; index < scenario.months; index++) {
    const step = advance(snapshot, scenario.seed);
    yield { turnNumber: Number(snapshot.turnNumber), result: step.result };
    snapshot = step.next;
  }
}

export function recordReplay(scenario: ReplayScenario): string {
  const { state, contentHash } = production();
  const months: ReplayFile["months"][number][] = [];
  for (const executed of executeScenario(scenario)) {
    months.push(monthCheckpoint(executed.turnNumber, executed.result));
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

export function firstLedgerDifference(
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

export function verifyReplay(
  text: string,
  options: VerifyOptions = {},
): Result.Result<VerifyOutcome, ReplayFileError> {
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
    const step = advance(
      snapshot,
      file.seed,
      options.perturb?.month === month ? options.perturb : undefined,
    );
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
    if (options.roundTrip !== undefined && month < file.months.length) {
      const expected = fullSnapshotHash(snapshot);
      const stored = options.roundTrip.lossy?.(snapshot, month) ?? snapshot;
      const trip = saveAndLoad(stored);
      const actual = trip.ok ? fullSnapshotHash(trip.snapshot) : `(load failed: ${trip.reason})`;
      if (actual !== expected) {
        return fail({
          month,
          turnNumber: Number(snapshot.turnNumber),
          where: "roundtrip",
          expected,
          actual,
        });
      }
      if (trip.ok) snapshot = trip.snapshot;
    }
  }
  return Result.succeed<VerifyOutcome>({ ok: true, months: file.months.length });
}
