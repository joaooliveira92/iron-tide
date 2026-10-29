import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CampaignSnapshot } from "@bluewave/campaign";
import { unifiedSnapshotHash } from "@bluewave/campaign";
import { fleetManagementFromRulesets } from "@bluewave/content-compiler";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore, restampState } from "@bluewave/persistence";
import { MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { Effect, Result } from "effect";

import { compileProductionCampaign } from "../production-pack.js";
import { LEDGER_ORDER, ledgerEntryText, monthCheckpoint } from "./checkpoint.js";
import {
  REPLAY_FORMAT_VERSION,
  ReplayFileError,
  decodeReplayFile,
  type LedgerName,
  type ReplayCommandEnvelope,
  type ReplayFile,
  type ReplaySetupId,
} from "./format.js";

export interface ScenarioCommand {
  readonly month: number;
  readonly body: ReplayCommandEnvelope["body"];
}

export interface ReplayScenario {
  readonly id: string;
  readonly seed: string;
  readonly months: number;
  readonly commands?: readonly ScenarioCommand[];
  readonly playerNationId?: string;
  readonly setup?: ReplaySetupId;
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

function productionFleetManagement() {
  const decoded = fleetManagementFromRulesets(production().bundle.rulesets);
  if (decoded === undefined) return undefined;
  if (!decoded.ok)
    throw new ReplayFileError({
      message: `production fleetManagement section is invalid at '${decoded.field}'`,
    });
  return decoded.value;
}

export function productionStartSnapshot(): CampaignSnapshot {
  return production().state.snapshot;
}

const ARMED_FIREPOWER = SafeInt(400);
const COMMISSIONED_SHIP = "aut_tegetthoff";
const ARMED_NATIONS: readonly string[] = ["austria_hungary", "italy"];

function armedAdriaticWar(snapshot: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  for (const nationId of ARMED_NATIONS) {
    const nation = nations.get(nationId);
    if (nation === undefined) continue;
    nations.set(nationId, {
      ...nation,
      fleets: nation.fleets.map((fleet) => ({
        ...fleet,
        ships: fleet.ships.map((ship) => ({
          ...ship,
          firepower: ARMED_FIREPOWER,
          isUnderConstruction: ship.id === COMMISSIONED_SHIP ? false : ship.isUnderConstruction,
        })),
      })),
    });
  }
  return { ...snapshot, nations };
}

const SETUPS: Readonly<Record<ReplaySetupId, (snapshot: CampaignSnapshot) => CampaignSnapshot>> = {
  "armed-adriatic-war": armedAdriaticWar,
};

export function startSnapshot(setup?: ReplaySetupId): CampaignSnapshot {
  const snapshot = production().state.snapshot;
  return setup === undefined ? snapshot : SETUPS[setup](snapshot);
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

export function fleetManagementOptions(playerNationId?: string) {
  const fleetManagement = productionFleetManagement();
  return {
    ...(fleetManagement === undefined ? {} : { fleetManagement }),
    ...(playerNationId === undefined ? {} : { playerNationId }),
  };
}

export function playerNationOf(engineOptions: ReplayFile["engineOptions"]): string | undefined {
  return engineOptions.kind === "player" ? engineOptions.playerNationId : undefined;
}

export function advance(
  snapshot: CampaignSnapshot,
  seed: string,
  perturb?: Omit<ExecutorPerturbation, "month">,
  playerNationId?: string,
) {
  const result = new MonthExecutor().execute(
    perturb?.snapshot?.(snapshot) ?? snapshot,
    perturb?.commands?.(snapshot) ?? [],
    perturb?.seed?.(monthSeed(seed, snapshot)) ?? monthSeed(seed, snapshot),
    new DiagnosticCollector(),
    undefined,
    fleetManagementOptions(playerNationId),
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
  readonly commands: readonly ReplayCommandEnvelope[];
}

export function scenarioEnvelopes(
  scenario: ReplayScenario,
  month: number,
  snapshot: CampaignSnapshot,
): ReplayCommandEnvelope[] {
  const snapshotHash = sha256Hex(canonicalSerialize(snapshot));
  return (scenario.commands ?? [])
    .filter((command) => command.month === month)
    .map((command, index) => {
      const commandId = `${scenario.id}-m${String(month)}-${String(index)}`;
      return {
        commandId,
        version: "0.1.0",
        expectedSnapshotHash: snapshotHash,
        idempotencyKey: `ik-${commandId}`,
        timestamp: "replay-corpus",
        body: command.body,
      };
    });
}

export function* executeScenario(scenario: ReplayScenario): Generator<ExecutedMonth> {
  let snapshot = startSnapshot(scenario.setup);
  for (let index = 0; index < scenario.months; index++) {
    const commands = scenarioEnvelopes(scenario, index + 1, snapshot);
    const step = advance(
      snapshot,
      scenario.seed,
      { commands: () => commands as CommandEnvelope<CommandBody>[] },
      scenario.playerNationId,
    );
    yield { turnNumber: Number(snapshot.turnNumber), result: step.result, commands };
    snapshot = step.next;
  }
}

export function recordReplay(scenario: ReplayScenario): string {
  const { state, contentHash } = production();
  const months: ReplayFile["months"][number][] = [];
  for (const executed of executeScenario(scenario)) {
    months.push(monthCheckpoint(executed.turnNumber, executed.result, executed.commands));
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
      snapshotHash: unifiedSnapshotHash(startSnapshot(scenario.setup)),
      ...(scenario.setup === undefined ? {} : { setup: scenario.setup }),
    },
    engineOptions:
      scenario.playerNationId === undefined
        ? { kind: "default" }
        : { kind: "player", playerNationId: scenario.playerNationId },
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
  const { contentHash } = production();
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
  let snapshot = startSnapshot(file.initial.setup);
  const initialHash = unifiedSnapshotHash(snapshot);
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
    const perturb = options.perturb?.month === month ? options.perturb : undefined;
    const step = advance(
      snapshot,
      file.seed,
      {
        commands: () => recorded.commands as CommandEnvelope<CommandBody>[],
        ...perturb,
      },
      playerNationOf(file.engineOptions),
    );
    const actual = monthCheckpoint(Number(snapshot.turnNumber), step.result, recorded.commands);
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
      const expected = unifiedSnapshotHash(snapshot);
      const stored = options.roundTrip.lossy?.(snapshot, month) ?? snapshot;
      const trip = saveAndLoad(stored);
      const actual = trip.ok ? unifiedSnapshotHash(trip.snapshot) : `(load failed: ${trip.reason})`;
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
