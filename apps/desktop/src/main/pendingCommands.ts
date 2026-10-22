import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Result, Schema } from "effect";
import { getCampaignSession } from "./campaignSessions.js";

export interface PendingCommandEntry {
  readonly transportRequestId: string;
  readonly envelope: CommandEnvelope<CommandBody>;
  readonly payloadFingerprint: string;
}

const pendingBySession = new Map<string, Map<string, PendingCommandEntry>>();

function pendingFor(sessionId: string): Map<string, PendingCommandEntry> {
  const existing = pendingBySession.get(sessionId);
  if (existing) return existing;
  const created = new Map<string, PendingCommandEntry>();
  pendingBySession.set(sessionId, created);
  return created;
}

export function fingerprintOfBody(body: CommandBody): string {
  return sha256Hex(canonicalSerialize(body));
}

export const PENDING_COMMANDS_FILENAME = "pending-commands.json";

const StoredQueueSchema = Schema.Struct({
  schema: Schema.Literal("pending_commands_v1"),
  turnNumber: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  entries: Schema.Array(
    Schema.Struct({
      transportRequestId: Schema.String.check(Schema.isMinLength(1)),
      envelope: Schema.Record(Schema.String, Schema.Unknown),
      payloadFingerprint: Schema.String.check(Schema.isMinLength(1)),
    }),
  ).check(Schema.isMaxLength(1000)),
});

function persistQueue(sessionId: string): void {
  const record = getCampaignSession(sessionId);
  if (!record) return;
  const path = join(record.saveDir, PENDING_COMMANDS_FILENAME);
  const entries = [...(pendingBySession.get(sessionId)?.values() ?? [])];
  try {
    if (entries.length === 0) {
      rmSync(path, { force: true });
      return;
    }
    const tmp = `${path}.tmp`;
    writeFileSync(
      tmp,
      canonicalSerialize({
        schema: "pending_commands_v1",
        turnNumber: Number(record.state.snapshot.turnNumber),
        entries,
      }),
      "utf8",
    );
    renameSync(tmp, path);
  } catch {}
}

export function restorePendingQueue(sessionId: string): number {
  const record = getCampaignSession(sessionId);
  if (!record) return 0;
  const path = join(record.saveDir, PENDING_COMMANDS_FILENAME);
  if (!existsSync(path)) return 0;
  let parsed: typeof StoredQueueSchema.Type | null = null;
  try {
    const r = Schema.decodeUnknownResult(StoredQueueSchema)(JSON.parse(readFileSync(path, "utf8")));
    parsed = Result.isSuccess(r) ? r.success : null;
  } catch {
    parsed = null;
  }
  if (parsed === null || parsed.turnNumber !== Number(record.state.snapshot.turnNumber)) {
    try {
      rmSync(path, { force: true });
    } catch {}
    return 0;
  }
  const queue = pendingFor(sessionId);
  for (const e of parsed.entries)
    queue.set(e.transportRequestId, {
      transportRequestId: e.transportRequestId,
      envelope: e.envelope as unknown as CommandEnvelope<CommandBody>,
      payloadFingerprint: e.payloadFingerprint,
    });
  return parsed.entries.length;
}

export function queuePendingEnvelope(sessionId: string, entry: PendingCommandEntry): void {
  pendingFor(sessionId).set(entry.transportRequestId, entry);
  persistQueue(sessionId);
}

export function lookupPendingEnvelope(
  sessionId: string,
  transportRequestId: string,
): PendingCommandEntry | undefined {
  return pendingBySession.get(sessionId)?.get(transportRequestId);
}

export function pendingEnvelopesForExecution(
  sessionId: string,
  snapshot: CampaignSnapshot,
): CommandEnvelope<CommandBody>[] {
  const pending = pendingBySession.get(sessionId);
  if (pending === undefined || pending.size === 0) return [];
  const executionHash = sha256Hex(canonicalSerialize(snapshot));
  return [...pending.values()].map((queued) => ({
    ...queued.envelope,
    expectedSnapshotHash: executionHash,
  }));
}

export function pendingEntries(sessionId: string): PendingCommandEntry[] {
  return [...(pendingBySession.get(sessionId)?.values() ?? [])];
}

export function clearPendingEnvelopes(sessionId: string): void {
  pendingBySession.delete(sessionId);
  persistQueue(sessionId);
}

export function deletePendingEnvelope(sessionId: string, transportRequestId: string): void {
  const sessionQueue = pendingBySession.get(sessionId);
  if (!sessionQueue) return;
  sessionQueue.delete(transportRequestId);
  if (sessionQueue.size === 0) pendingBySession.delete(sessionId);
  persistQueue(sessionId);
}

export function clearPendingWorkspacesForTest(): void {
  pendingBySession.clear();
}
