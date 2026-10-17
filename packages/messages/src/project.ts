import { campaignMonthId, type CampaignSnapshot } from "@bluewave/campaign";
import type { DomainEventEnvelope } from "@bluewave/events";
import {
  aggregate,
  deduplicate,
  sortMessages,
  withIdentities,
  type MessageDraft,
} from "./aggregate.js";
import { classifyEventBody } from "./policy.js";
import { describeEventBody } from "./provenance.js";
import type { TurnMessage } from "./schema.js";
import { PROJECTION_VERSION } from "./version.js";

/**
 * Everything the projection needs: the month's authoritative domain events, the
 * authoritative pre-turn snapshot (for the campaign date), and the version
 * descriptors carried into provenance. No renderer, locale, or ambient state.
 */
export interface ProjectionInput {
  readonly turnId: string;
  readonly events: readonly DomainEventEnvelope[];
  readonly snapshot: ProjectionSnapshot;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
}

/** The snapshot fields the projection reads (the campaign date anchor). */
export type ProjectionSnapshot = Pick<CampaignSnapshot, "startYear" | "startMonth" | "turnNumber">;

function draftFor(
  input: ProjectionInput,
  occurredAt: string,
  event: DomainEventEnvelope,
): MessageDraft {
  const classification = classifyEventBody(event.body);
  const description = describeEventBody(event.body);
  return {
    turnId: input.turnId,
    occurredAt,
    phase: classification.phase,
    category: classification.category,
    severity: classification.severity,
    titleKey: classification.titleKey,
    bodyKey: classification.bodyKey,
    interpolation: description.interpolation,
    subjectRefs: [...description.subjectRefs],
    effectRefs: [...description.effectRefs],
    blocking: false,
    requiresAcknowledgement: false,
    deduplicationKey: classification.deduplicationKey,
    aggregateKey: classification.aggregateKey,
    playerVisible: classification.playerVisible,
    debugMetadata: {
      sourceEventIds: [event.eventId],
      projectionVersion: PROJECTION_VERSION,
      rulesetVersion: input.rulesetVersion,
      contentVersion: input.contentVersion,
    },
  };
}

/**
 * Project a turn's authoritative domain events into structured, deterministic
 * messages: classified, aggregated, deduplicated, canonically ordered, and
 * content-addressed. Pure and total — the same input always yields the same
 * output, including `TRACE` developer-only messages (`playerVisible: false`).
 */
export function projectTurnMessages(input: ProjectionInput): TurnMessage[] {
  const occurredAt = campaignMonthId(
    input.snapshot.startYear,
    input.snapshot.startMonth,
    input.snapshot.turnNumber,
  );
  const drafts = input.events.map((event) => draftFor(input, occurredAt, event));
  const ordered = sortMessages(drafts);
  const deduped = deduplicate(ordered);
  const aggregated = aggregate(deduped);
  return withIdentities(input.turnId, sortMessages(aggregated));
}

/** The player-facing subset — everything except developer-only `TRACE` messages. */
export function playerVisibleMessages(messages: readonly TurnMessage[]): TurnMessage[] {
  return messages.filter((message) => message.playerVisible);
}
