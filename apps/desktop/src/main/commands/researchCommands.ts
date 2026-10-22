import type { CommandEnvelope, SetResearchPriorityCommand } from "@bluewave/commands";
import type { SafeInt } from "@bluewave/contracts";
import {
  buildResearchScreenProjection,
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  ResearchPriorityOutcome,
  ResearchScreenProjection,
} from "../../shared/research-contract.js";
import {
  SessionIdPayloadSchema,
  SetResearchPriorityCommandPayloadSchema,
} from "../../shared/campaignCommandSchemas.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import type { PendingCommandEntry } from "../pendingCommands.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { CommandFailed, CommandRejected } from "../runtime/commandError.js";
import { withSchema } from "../runtime/commandProgram.js";
import { CommandQueueStore } from "../runtime/commandQueueStore.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { currentRevision, deterministicTimestamp, verifyEnvelope } from "./commandEnvelope.js";

export const inspectResearchScreenProgram = withSchema(SessionIdPayloadSchema, (sessionId) =>
  Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId);

    const projection = buildResearchScreenProjection(
      record.state,
      record.playerSlotId,
      record.month,
    );
    if (!projection) {
      return yield* new CommandFailed({
        reason: "UNKNOWN_PLAYER_SLOT",
        diagnostics: [`No nation ${record.playerSlotId} in session ${sessionId}`],
      });
    }

    const value: ResearchScreenProjection = {
      ...projection,
      revision: currentRevision(record),
      month: record.month,
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);

export const setResearchPriorityCommandProgram = withSchema(
  SetResearchPriorityCommandPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const sessions = yield* CampaignSessionStore;
      const queue = yield* CommandQueueStore;
      const projects = yield* ProjectStore;
      const record = yield* sessions.get(payload.sessionId);

      const verified = verifyEnvelope(record, payload.expectedRevision);
      if (verified.outcome !== "success") return verified;

      const violations = validateResearchPriorities(payload.fieldPriorities);
      if (violations.length > 0) {
        return yield* new CommandRejected({
          reason: "RESEARCH_PRIORITY_CONSTRAINT_VIOLATED",
          diagnostics: violations,
        });
      }

      if (payload.exactTechId !== undefined) {
        return yield* new CommandRejected({
          reason: "EXACT_TECHNOLOGY_SELECTION_PROHIBITED",
          diagnostics: [`Exact technology selection is prohibited: ${payload.exactTechId}`],
        });
      }

      const frozenPriorities: Readonly<Record<string, number>> = Object.freeze({
        ...payload.fieldPriorities,
      });
      const exactTechId = payload.exactTechId;

      const envelope = buildResearchEnvelope(record, frozenPriorities, exactTechId);
      const prior = yield* queue.lookup(payload.sessionId, payload.transportRequestId);
      if (prior) {
        if (prior.payloadFingerprint !== queue.fingerprintOfBody(envelope.body)) {
          return yield* new CommandRejected({
            reason: "IDEMPOTENCY_CONFLICT",
            diagnostics: [
              `transportRequestId ${payload.transportRequestId} was already used by command ${prior.envelope.commandId}`,
            ],
          });
        }
        return replayOutcome(prior);
      }

      yield* queue.queue(payload.sessionId, {
        transportRequestId: payload.transportRequestId,
        envelope,
        payloadFingerprint: queue.fingerprintOfBody(envelope.body),
      });

      yield* projects
        .save(record.state, record.saveDir)
        .pipe(Effect.tapError(() => queue.delete(payload.sessionId, payload.transportRequestId)));

      return { outcome: "success" as const, value: outcomeFor(envelope), diagnostics: [] };
    }),
);

const PLAYER_ENVELOPE_VERSION = "0.1.0" as const;

function buildResearchEnvelope(
  record: CampaignSessionRecord,
  fieldPriorities: Readonly<Record<string, number>>,
  exactTechId: string | undefined,
): CommandEnvelope<SetResearchPriorityCommand> {
  const snapshot = record.state.snapshot;
  const idempotencyKey = [
    encodeURIComponent(snapshot.campaignId),
    String(Number(snapshot.turnNumber)),
    encodeURIComponent(record.playerSlotId),
    "SetResearchPriority",
  ].join("/");
  const commandId = `player-${sha256Hex(`v0:${idempotencyKey}`).slice(0, 40)}`;

  const priorities: Record<string, SafeInt> = {};
  for (const [field, weight] of Object.entries(fieldPriorities)) {
    assertSafeInteger(weight, field);
    priorities[field] = weight as SafeInt;
  }

  const body: SetResearchPriorityCommand = {
    type: "SetResearchPriority",
    nationId: record.playerSlotId,
    fieldPriorities: Object.freeze(priorities),
  };
  if (exactTechId !== undefined) body.exactTechId = exactTechId;

  return {
    commandId,
    version: PLAYER_ENVELOPE_VERSION,
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey,
    timestamp: deterministicTimestamp(record),
    body,
    issuerClass: "PLAYER",
    issuerParticipantId: record.playerSlotId,
  };
}

function validateResearchPriorities(fieldPriorities: Readonly<Record<string, number>>): string[] {
  const diagnostics: string[] = [];
  for (const [field, weight] of Object.entries(fieldPriorities)) {
    if (
      !CANONICAL_RESEARCH_FIELD_IDS.includes(field as (typeof CANONICAL_RESEARCH_FIELD_IDS)[number])
    ) {
      diagnostics.push(`unknown research field "${field}"`);
    }
    if (!Number.isSafeInteger(weight)) {
      diagnostics.push(`non-integer priority ${String(weight)} for field "${field}"`);
    }
  }
  const validWeights = new Set<number>([
    RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
    RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM,
    RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW,
  ]);
  const missing = CANONICAL_RESEARCH_FIELD_IDS.filter(
    (field) => fieldPriorities[field] === undefined,
  );
  const invalidWeight = CANONICAL_RESEARCH_FIELD_IDS.filter(
    (field) =>
      fieldPriorities[field] !== undefined && !validWeights.has(fieldPriorities[field] as number),
  );
  const highCount = CANONICAL_RESEARCH_FIELD_IDS.filter(
    (field) => fieldPriorities[field] === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
  ).length;
  if (missing.length > 0) diagnostics.push(`missing fields: ${missing.join(",")}`);
  if (invalidWeight.length > 0)
    diagnostics.push(`invalid weight for fields: ${invalidWeight.join(",")}`);
  if (highCount < 1 || highCount > MAX_HIGH_PRIORITY_FIELDS) {
    diagnostics.push(
      `high-priority field count ${String(highCount)} must be in 1..${String(MAX_HIGH_PRIORITY_FIELDS)}`,
    );
  }
  return diagnostics;
}

function assertSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`fieldPriorities[${field}] must be a safe integer, got ${String(value)}`);
  }
}

function outcomeFor(envelope: {
  commandId: string;
  body: SetResearchPriorityCommand;
}): ResearchPriorityOutcome {
  const priorities: Record<string, number> = {};
  for (const [field, weight] of Object.entries(envelope.body.fieldPriorities)) {
    priorities[field] = Number(weight);
  }
  return { commandId: envelope.commandId, priorities, appliedOnNextTurn: true };
}

function replayOutcome(prior: PendingCommandEntry): BridgeResult<ResearchPriorityOutcome> {
  return {
    outcome: "success",
    value: outcomeFor({
      commandId: prior.envelope.commandId,
      body: prior.envelope.body as SetResearchPriorityCommand,
    }),
    diagnostics: [],
  };
}
