import { SafeInt } from "@bluewave/contracts";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import type { ProjectionSnapshot } from "../src/index.js";

export function snapshot(overrides: Partial<ProjectionSnapshot> = {}): ProjectionSnapshot {
  return { startYear: 1880, startMonth: 1, turnNumber: SafeInt(1), ...overrides };
}

export function envelope(
  body: DomainEventBody,
  aggregateId: string,
  sequenceNumber = 1,
): DomainEventEnvelope {
  return {
    eventId: `${body.kind}-${aggregateId}-${String(sequenceNumber)}`,
    version: "0.1.0",
    aggregateType: body.kind,
    aggregateId,
    eventType: body.kind,
    timestamp: "1880-02-01T00:00:00.000Z",
    body,
    sequenceNumber: SafeInt(sequenceNumber),
  };
}
