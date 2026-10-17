import { canonicalSerialize, compareCodePoints, hashWithContext } from "@bluewave/deterministic";
import { SEVERITY_RANK } from "./policy.js";
import type { TurnMessage } from "./schema.js";
import { PROJECTION_VERSION } from "./version.js";

/** A projected message before its identity is assigned. */
export type MessageDraft = Omit<TurnMessage, "id">;

function refKey(ref: { readonly type: string; readonly id: string }): string {
  return `${ref.type}\u0000${ref.id}`;
}

function compareRefs(
  a: { readonly type: string; readonly id: string },
  b: { readonly type: string; readonly id: string },
): number {
  return compareCodePoints(refKey(a), refKey(b));
}

function compareDrafts(a: MessageDraft, b: MessageDraft): number {
  return (
    compareCodePoints(a.occurredAt, b.occurredAt) ||
    compareCodePoints(a.category, b.category) ||
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    compareCodePoints(a.aggregateKey ?? "", b.aggregateKey ?? "") ||
    compareCodePoints(a.deduplicationKey ?? "", b.deduplicationKey ?? "") ||
    compareCodePoints(
      (a.debugMetadata?.sourceEventIds ?? []).join(","),
      (b.debugMetadata?.sourceEventIds ?? []).join(","),
    ) ||
    compareCodePoints(canonicalSerialize(a.subjectRefs), canonicalSerialize(b.subjectRefs))
  );
}

/** Total, deterministic ordering of projected messages. */
export function sortMessages(messages: readonly MessageDraft[]): MessageDraft[] {
  return [...messages].sort(compareDrafts);
}

/** Collapse messages sharing a deduplication key; critical messages never merge. */
export function deduplicate(messages: readonly MessageDraft[]): MessageDraft[] {
  const seen = new Set<string>();
  const out: MessageDraft[] = [];
  for (const message of messages) {
    const key = message.deduplicationKey;
    if (key === undefined || message.severity === "CRITICAL") {
      out.push(message);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(message);
  }
  return out;
}

function mergeGroup(group: readonly MessageDraft[]): MessageDraft {
  const [first] = group;
  if (first === undefined) throw new Error("mergeGroup requires a non-empty group");
  if (group.length === 1) return first;

  const subjectRefs = group.flatMap((m) => m.subjectRefs).sort(compareRefs);
  const uniqueSubjects = subjectRefs.filter(
    (ref, index) => index === 0 || refKey(subjectRefs[index - 1]!) !== refKey(ref),
  );

  const effectRefs = group.flatMap((m) => m.effectRefs);
  const uniqueEffects = [
    ...new Map(effectRefs.map((ref) => [canonicalSerialize(ref), ref])).values(),
  ].sort((a, b) => compareCodePoints(canonicalSerialize(a), canonicalSerialize(b)));

  const sourceEventIds = [
    ...new Set(group.flatMap((m) => m.debugMetadata?.sourceEventIds ?? [])),
  ].sort(compareCodePoints);

  const effects = first.effectRefs.length > 0 ? uniqueEffects : first.effectRefs;
  const subjects = first.subjectRefs.length > 0 ? uniqueSubjects : first.subjectRefs;

  return {
    ...first,
    interpolation: { ...first.interpolation, count: group.length },
    subjectRefs: subjects,
    effectRefs: effects,
    debugMetadata:
      first.debugMetadata === undefined ? undefined : { ...first.debugMetadata, sourceEventIds },
  };
}

/**
 * Aggregate routine player-visible messages sharing an aggregate key into one
 * message carrying a `count` and the union of their references. Messages without
 * an aggregate key, developer-only (`TRACE`) messages, and critical outcomes are
 * never merged.
 */
export function aggregate(messages: readonly MessageDraft[]): MessageDraft[] {
  const aggregable = new Map<string, MessageDraft[]>();
  const passthrough: MessageDraft[] = [];
  for (const message of messages) {
    if (!message.playerVisible || message.aggregateKey === undefined) {
      passthrough.push(message);
      continue;
    }
    const group = aggregable.get(message.aggregateKey) ?? [];
    group.push(message);
    aggregable.set(message.aggregateKey, group);
  }
  const merged = [...aggregable.values()].map(mergeGroup);
  return [...passthrough, ...merged];
}

function messageIdentity(turnId: string, message: MessageDraft): string {
  const body = canonicalSerialize({
    projectionVersion: PROJECTION_VERSION,
    turnId,
    category: message.category,
    severity: message.severity,
    titleKey: message.titleKey,
    bodyKey: message.bodyKey,
    deduplicationKey: message.deduplicationKey ?? null,
    aggregateKey: message.aggregateKey ?? null,
    interpolation: message.interpolation,
    subjectRefs: message.subjectRefs,
    effectRefs: message.effectRefs,
    sourceEventIds: message.debugMetadata?.sourceEventIds ?? [],
  });
  return hashWithContext(body, "bluewave/messages/turn-message");
}

/**
 * Assign each message a content-addressed, deterministic identity. The id is a
 * function of the turn and the message's projected content, so identical
 * projections across hosts and re-executions collide by construction.
 */
export function withIdentities(turnId: string, messages: readonly MessageDraft[]): TurnMessage[] {
  return messages.map((message) => ({
    ...message,
    id: messageIdentity(turnId, message),
  }));
}
