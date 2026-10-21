import type { CampaignSnapshot } from "@bluewave/campaign";
import { canonicalSerialize, compareCodePoints, hashWithContext } from "@bluewave/deterministic";
import type { MonthResult } from "@bluewave/phase-engine";

import type { LedgerName, ReplayFile } from "./format.js";

type MonthCheckpoint = ReplayFile["months"][number];

const SNAPSHOT_CONTEXT = "bluewave/replay-corpus/snapshot/v1";
const ENTRY_CONTEXT = "bluewave/replay-corpus/ledger-entry/v1";

export const LEDGER_ORDER: readonly LedgerName[] = ["command", "event", "financial", "random"];

/**
 * Plain, order-independent form of authoritative state. `canonicalSerialize` sees
 * a `Map` or `Set` as `{}`, so they are made explicit and sorted here.
 */
function plain(value: unknown): unknown {
  if (value instanceof Map) {
    const entries = [...value].map(([key, item]) => [plain(key), plain(item)] as const);
    entries.sort((a, b) => compareCodePoints(canonicalSerialize(a[0]), canonicalSerialize(b[0])));
    return { $map: entries };
  }
  if (value instanceof Set) {
    return {
      $set: [...value]
        .map(plain)
        .sort((a, b) => compareCodePoints(canonicalSerialize(a), canonicalSerialize(b))),
    };
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = plain(item);
    return out;
  }
  return value;
}

/** Hash of the whole snapshot, including the fields the legacy subset hash omits. */
export function fullSnapshotHash(snapshot: CampaignSnapshot): string {
  return hashWithContext(canonicalSerialize(plain(snapshot)), SNAPSHOT_CONTEXT);
}

function ledgerCheckpoint(entries: readonly unknown[]): MonthCheckpoint["ledgers"]["command"] {
  return {
    count: entries.length,
    entryHashes: entries.map((entry) =>
      hashWithContext(canonicalSerialize(plain(entry)), ENTRY_CONTEXT),
    ),
  };
}

export function monthCheckpoint(turnNumber: number, result: MonthResult): MonthCheckpoint {
  return {
    turnNumber,
    commands: [],
    snapshotHash: fullSnapshotHash(result.finalSnapshot),
    ledgers: {
      command: ledgerCheckpoint(result.commandLedger.all),
      event: ledgerCheckpoint(result.eventLedger.all),
      financial: ledgerCheckpoint(result.financialLedger.all),
      random: ledgerCheckpoint(result.randomLedger.all),
    },
  };
}

/** Canonical text of one ledger entry, for showing the value behind a divergent hash. */
export function ledgerEntryText(
  result: MonthResult,
  ledger: LedgerName,
  index: number,
): string | undefined {
  const entry = {
    command: result.commandLedger.all,
    event: result.eventLedger.all,
    financial: result.financialLedger.all,
    random: result.randomLedger.all,
  }[ledger][index];
  return entry === undefined ? undefined : canonicalSerialize(plain(entry));
}
