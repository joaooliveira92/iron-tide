import { monthlyRevenue, researchCap } from "@bluewave/campaign";
import type { CampaignSlot, CampaignSnapshot } from "@bluewave/campaign";
import {
  APPROPRIATION_RATE_MAX_BP,
  APPROPRIATION_RATE_MIN_BP,
  RESEARCH_BUDGET_MAX,
  RESEARCH_BUDGET_MIN,
} from "@bluewave/campaign";
import { buildConstructionDesignCatalog } from "@bluewave/campaign-engine";
import {
  CommandIdempotencyMap,
  CommandLifecycle,
  type CommandBody,
  type CommandEnvelope,
} from "@bluewave/commands";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, hashWithContext, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine, splitSeed, type RandomStream } from "@bluewave/random";
import { Data, Result, Schema } from "effect";

import {
  advance,
  firstLedgerDifference,
  productionStartSnapshot,
  saveAndLoad,
  type ExecutorPerturbation,
  type ReplayDivergence,
  type RoundTripOptions,
} from "./corpus.js";
import { LEDGER_ORDER, fullSnapshotHash, monthCheckpoint } from "./checkpoint.js";
import { SUBSYSTEMS, monthCoverage } from "./coverage.js";
import type { ReplayFile } from "./format.js";

type MonthCheckpoint = ReplayFile["months"][number];

/** A generated scenario is fully named by its seed and length. */
export interface FuzzCase {
  readonly seed: string;
  readonly months: number;
}

/**
 * The fuzz corpus run by the test suite and pinned in `golden/replay-fuzz.json`. The budget is
 * bounded on purpose (a handful of short cases); a new case is added here and re-recorded locally.
 */
export const FUZZ_CASES: readonly FuzzCase[] = [
  { seed: "fuzz-1880-a", months: 4 },
  { seed: "fuzz-1880-b", months: 4 },
  { seed: "fuzz-1880-c", months: 4 },
  { seed: "fuzz-1880-d", months: 4 },
  { seed: "fuzz-1880-e", months: 4 },
  { seed: "fuzz-1880-f", months: 4 },
];

const ROOT_CONTEXT = "bluewave/replay-fuzz/v1";
const MONTH_DIGEST_CONTEXT = "bluewave/replay-fuzz/month/v1";
const CASE_DIGEST_CONTEXT = "bluewave/replay-fuzz/case/v1";
const MAX_COMMANDS_PER_MONTH = 3;
const KINDS = ["SetBudgetAllocation", "SetResearchPriority", "OrderConstruction"] as const;

/** Uniform integer in `lo..hi` from one draw of a domain-separated stream. */
function pick(stream: RandomStream, lo: number, hi: number): number {
  return lo + Math.min(hi - lo, Math.floor(stream.next() * (hi - lo + 1)));
}

function candidate(
  kind: (typeof KINDS)[number],
  snapshot: CampaignSnapshot,
  slot: CampaignSlot,
  engine: RandomEngine,
  index: number,
): CommandBody | undefined {
  const stream = engine.stream(`command:${String(index)}:${kind}`);
  if (kind === "SetBudgetAllocation") {
    const nation = snapshot.nations.get(slot.nationId);
    if (nation === undefined) return undefined;
    const rate = pick(stream, APPROPRIATION_RATE_MIN_BP, APPROPRIATION_RATE_MAX_BP);
    const cap = Number(researchCap(monthlyRevenue(nation.baseResources, SafeInt(rate))));
    return {
      type: "SetBudgetAllocation",
      nationId: slot.nationId,
      appropriationRateBp: SafeInt(rate),
      researchBudget: SafeInt(
        pick(stream, RESEARCH_BUDGET_MIN, Math.min(RESEARCH_BUDGET_MAX, cap)),
      ),
    };
  }
  if (kind === "SetResearchPriority") {
    const weights = Object.values(RESEARCH_FIELD_PRIORITY_WEIGHTS);
    const fieldPriorities: Record<string, SafeInt> = {};
    for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
      fieldPriorities[field] = SafeInt(weights[pick(stream, 0, weights.length - 1)] ?? 1);
    }
    return { type: "SetResearchPriority", nationId: slot.nationId, fieldPriorities };
  }
  const month = Number(snapshot.turnNumber);
  const year = snapshot.startYear + Math.floor((snapshot.startMonth - 1 + month) / 12);
  const buildable = buildConstructionDesignCatalog(snapshot, slot.nationId, year).filter(
    (entry) => entry.available,
  );
  const design = buildable[pick(stream, 0, Math.max(0, buildable.length - 1))];
  if (design === undefined) return undefined;
  return {
    type: "OrderConstruction",
    nationId: slot.nationId,
    designVersionId: design.designId,
    quantity: pick(stream, 1, 2),
  };
}

/**
 * The commands for the month about to run: a seeded draw from the engine's own command families
 * for the player nation, each kept only if the production `CommandLifecycle` accepts it against
 * this snapshot. The engine therefore defines validity; the generator never second-guesses it.
 */
export function generateFuzzCommands(
  seed: string,
  snapshot: CampaignSnapshot,
): { issued: number; commands: CommandEnvelope<CommandBody>[] } {
  const slot = snapshot.slots[0];
  if (slot === undefined) return { issued: 0, commands: [] };
  const turn = String(snapshot.turnNumber);
  const engine = new RandomEngine(splitSeed(splitSeed(seed, ROOT_CONTEXT), `month:${turn}`));
  const shape = engine.stream("shape");
  const count = pick(shape, 0, MAX_COMMANDS_PER_MONTH);
  const snapshotHash = sha256Hex(canonicalSerialize(snapshot));
  const lifecycle = new CommandLifecycle();
  const commands: CommandEnvelope<CommandBody>[] = [];
  for (let index = 0; index < count; index++) {
    const kind = KINDS[pick(shape, 0, KINDS.length - 1)] as (typeof KINDS)[number];
    const body = candidate(kind, snapshot, slot, engine, index);
    if (body === undefined) continue;
    const commandId = `fuzz-${turn}-${String(index)}`;
    const envelope: CommandEnvelope<CommandBody> = {
      commandId,
      version: "0.1.0",
      expectedSnapshotHash: snapshotHash,
      idempotencyKey: `ik-${commandId}`,
      timestamp: "replay-fuzz",
      body,
    };
    const outcome = lifecycle.process(envelope, snapshot, slot, new CommandIdempotencyMap());
    if (outcome.type === "success") commands.push(envelope);
  }
  return { issued: commands.length, commands };
}

export interface FuzzRun {
  readonly months: readonly MonthCheckpoint[];
  /** Per-month digest of the full checkpoint; the unit a pinned manifest compares. */
  readonly monthDigests: readonly string[];
  readonly digest: string;
  readonly commandsIssued: number;
  readonly commandsAccepted: number;
  /** Catalogue-ordered subsystems the run exercised. */
  readonly subsystems: readonly string[];
  /** Present when the save/load round trip lost data; the run stops there. */
  readonly roundTripDivergence?: ReplayDivergence;
}

export interface FuzzRunOptions {
  readonly perturb?: ExecutorPerturbation;
  readonly roundTrip?: RoundTripOptions;
}

/** Run a fuzz case through the real month executor, optionally saving and loading between months. */
export function runFuzzCase(fuzzCase: FuzzCase, options: FuzzRunOptions = {}): FuzzRun {
  let snapshot = productionStartSnapshot();
  const months: MonthCheckpoint[] = [];
  const seen = new Set<string>();
  let issued = 0;
  let accepted = 0;
  for (let month = 1; month <= fuzzCase.months; month++) {
    const generated = generateFuzzCommands(fuzzCase.seed, snapshot);
    issued += generated.issued;
    const perturb = options.perturb?.month === month ? options.perturb : undefined;
    const step = advance(snapshot, fuzzCase.seed, {
      ...perturb,
      commands: () => generated.commands,
    });
    months.push(monthCheckpoint(Number(snapshot.turnNumber), step.result));
    accepted += step.result.commandLedger.all.filter((o) => o.type === "success").length;
    for (const id of monthCoverage(step.result).subsystems) seen.add(id);
    snapshot = step.next;
    if (options.roundTrip !== undefined && month < fuzzCase.months) {
      const expected = fullSnapshotHash(snapshot);
      const stored = options.roundTrip.lossy?.(snapshot, month) ?? snapshot;
      const trip = saveAndLoad(stored);
      const actual = trip.ok ? fullSnapshotHash(trip.snapshot) : `(load failed: ${trip.reason})`;
      if (actual !== expected) {
        return finish(months, issued, accepted, seen, {
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
  return finish(months, issued, accepted, seen);
}

function finish(
  months: readonly MonthCheckpoint[],
  issued: number,
  accepted: number,
  seen: ReadonlySet<string>,
  roundTripDivergence?: ReplayDivergence,
): FuzzRun {
  const monthDigests = months.map((m) =>
    hashWithContext(canonicalSerialize(m), MONTH_DIGEST_CONTEXT),
  );
  return {
    months,
    monthDigests,
    digest: hashWithContext(canonicalSerialize(monthDigests), CASE_DIGEST_CONTEXT),
    commandsIssued: issued,
    commandsAccepted: accepted,
    subsystems: SUBSYSTEMS.map((s) => s.id).filter((id) => seen.has(id)),
    ...(roundTripDivergence === undefined ? {} : { roundTripDivergence }),
  };
}

/** Catalogue-ordered subsystems the fuzz corpus exercises; commands reach `command_collection`. */
export function fuzzSubsystems(cases: readonly FuzzCase[] = FUZZ_CASES): readonly string[] {
  const seen = new Set(cases.flatMap((c) => runFuzzCase(c).subsystems));
  return SUBSYSTEMS.map((s) => s.id).filter((id) => seen.has(id));
}

export type FuzzProperty = "repeatability" | "roundtrip" | "pinned";

export type FuzzOutcome =
  | { readonly ok: true; readonly digest: string }
  | {
      readonly ok: false;
      readonly property: FuzzProperty;
      readonly seed: string;
      readonly months: number;
      readonly divergence: ReplayDivergence;
    };

export interface PinnedCase extends FuzzCase {
  readonly digest: string;
  readonly monthDigests: readonly string[];
}

export interface CheckOptions {
  /** Perturbs the second repeatability run only (mutation check). */
  readonly secondRun?: ExecutorPerturbation;
  readonly roundTrip?: RoundTripOptions;
  /** When given, the run must also reproduce this checked-in digest (cross-OS equality). */
  readonly pinned?: PinnedCase;
}

function firstDifference(
  expected: readonly MonthCheckpoint[],
  actual: readonly MonthCheckpoint[],
): ReplayDivergence | undefined {
  for (const [index, a] of actual.entries()) {
    const e = expected[index];
    if (e === undefined) continue;
    for (const ledger of LEDGER_ORDER) {
      const d = firstLedgerDifference(e.ledgers[ledger].entryHashes, a.ledgers[ledger].entryHashes);
      if (d !== undefined) {
        return {
          month: index + 1,
          turnNumber: a.turnNumber,
          where: ledger,
          ...d,
          expectedCount: e.ledgers[ledger].count,
          actualCount: a.ledgers[ledger].count,
        };
      }
    }
    if (e.snapshotHash !== a.snapshotHash) {
      return {
        month: index + 1,
        turnNumber: a.turnNumber,
        where: "snapshot",
        expected: e.snapshotHash,
        actual: a.snapshotHash,
      };
    }
  }
  return undefined;
}

/**
 * Check the three fuzz properties for one case: two runs agree (repeatability), a save/load run
 * agrees with the straight run (round trip), and the digest equals the checked-in pin, which is
 * what makes the same case agree across operating systems. A failure names the seed.
 */
export function checkFuzzCase(fuzzCase: FuzzCase, options: CheckOptions = {}): FuzzOutcome {
  const fail = (property: FuzzProperty, divergence: ReplayDivergence): FuzzOutcome => ({
    ok: false,
    property,
    seed: fuzzCase.seed,
    months: fuzzCase.months,
    divergence,
  });
  const first = runFuzzCase(fuzzCase);
  const second = runFuzzCase(
    fuzzCase,
    options.secondRun === undefined ? {} : { perturb: options.secondRun },
  );
  const repeat = firstDifference(first.months, second.months);
  if (repeat !== undefined) return fail("repeatability", repeat);

  const tripped = runFuzzCase(fuzzCase, { roundTrip: options.roundTrip ?? {} });
  if (tripped.roundTripDivergence !== undefined) {
    return fail("roundtrip", tripped.roundTripDivergence);
  }
  const trip = firstDifference(first.months, tripped.months);
  if (trip !== undefined) return fail("roundtrip", trip);

  const pinned = options.pinned;
  if (pinned !== undefined) {
    const length = Math.max(pinned.monthDigests.length, first.monthDigests.length);
    let index = -1;
    for (let i = 0; i < length && index < 0; i++) {
      if (pinned.monthDigests[i] !== first.monthDigests[i]) index = i;
    }
    if (index >= 0 || pinned.digest !== first.digest) {
      const month = index < 0 ? 1 : index + 1;
      return fail("pinned", {
        month,
        turnNumber: first.months[month - 1]?.turnNumber ?? 0,
        where: "snapshot",
        expected: pinned.monthDigests[month - 1] ?? pinned.digest,
        actual: first.monthDigests[month - 1] ?? first.digest,
      });
    }
  }
  return { ok: true, digest: first.digest };
}

/** Stable text with the seed and the command that reproduces the failure locally. */
export function formatFuzzFailure(outcome: Extract<FuzzOutcome, { readonly ok: false }>): string {
  const d = outcome.divergence;
  const entry = d.entryIndex === undefined ? "" : ` entry ${String(d.entryIndex)}`;
  return [
    `fuzz ${outcome.property} failed: seed ${outcome.seed}, ${String(outcome.months)} months`,
    `  first difference at month ${String(d.month)} ${d.where}${entry}`,
    `  expected ${d.expected}`,
    `  actual   ${d.actual}`,
    `  reproduce: pnpm replay:fuzz run ${outcome.seed} ${String(outcome.months)}`,
    "",
  ].join("\n");
}

// ---- pinned manifest ----

const Hash = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/));
const FuzzManifestSchema = Schema.Struct({
  formatVersion: Schema.Literal(1),
  cases: Schema.Array(
    Schema.Struct({
      seed: Schema.String,
      months: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
      digest: Hash,
      monthDigests: Schema.Array(Hash),
    }),
  ),
});
export type FuzzManifest = typeof FuzzManifestSchema.Type;

export class FuzzManifestError extends Data.TaggedError("FuzzManifestError")<{
  readonly message: string;
}> {}

const decodeManifest = Schema.decodeUnknownResult(FuzzManifestSchema, {
  onExcessProperty: "error",
  errors: "all",
});

/** Decode manifest text strictly; throws `FuzzManifestError` on anything foreign or malformed. */
export function decodeFuzzManifest(text: string): FuzzManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FuzzManifestError({ message: "Fuzz manifest is not valid JSON" });
  }
  const decoded = decodeManifest(raw);
  if (Result.isFailure(decoded)) {
    throw new FuzzManifestError({ message: "Fuzz manifest failed validation" });
  }
  return decoded.success;
}

/** Canonical manifest text for `cases`; written only by the local record tool, never by CI. */
export function recordFuzzManifest(cases: readonly FuzzCase[]): string {
  const manifest: FuzzManifest = {
    formatVersion: 1,
    cases: cases.map((c) => {
      const run = runFuzzCase(c);
      return { seed: c.seed, months: c.months, digest: run.digest, monthDigests: run.monthDigests };
    }),
  };
  return `${canonicalSerialize(manifest)}\n`;
}
