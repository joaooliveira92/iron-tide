import type { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventBody, DomainEventEnvelope } from "./envelope.js";
import { DuplicateEventIdError, EventSequenceNotIncreasingError } from "./errors.js";
import { parseDomainEventEnvelope } from "./validation.js";

function aggregateKey(event: DomainEventEnvelope): string {
  return `${event.aggregateType}\u0000${event.aggregateId}`;
}

export class EventLedger {
  private readonly events: DomainEventEnvelope[] = [];
  private readonly eventIds = new Set<string>();
  private readonly lastSequenceByAggregate = new Map<string, SafeInt>();

  get all(): readonly DomainEventEnvelope[] {
    return Object.freeze([...this.events]);
  }

  append(event: DomainEventEnvelope<DomainEventBody>): void {
    const validated = parseDomainEventEnvelope(event);
    if (this.eventIds.has(validated.eventId)) {
      throw new DuplicateEventIdError({
        eventId: validated.eventId,
        message: `Duplicate eventId: ${validated.eventId}`,
      });
    }

    const key = aggregateKey(validated);
    const previousSequence = this.lastSequenceByAggregate.get(key);
    if (previousSequence !== undefined && validated.sequenceNumber <= previousSequence) {
      throw new EventSequenceNotIncreasingError({
        aggregateType: validated.aggregateType,
        aggregateId: validated.aggregateId,
        sequenceNumber: validated.sequenceNumber,
        previousSequence,
        message:
          `sequenceNumber must increase for ${validated.aggregateType}/${validated.aggregateId}: ` +
          `${String(validated.sequenceNumber)} <= ${String(previousSequence)}`,
      });
    }

    this.events.push(validated);
    this.eventIds.add(validated.eventId);
    this.lastSequenceByAggregate.set(key, validated.sequenceNumber);
  }

  hash(): string {
    return sha256Hex(canonicalSerialize(this.events));
  }

  toJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }
}
