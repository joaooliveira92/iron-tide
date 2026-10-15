import type { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope, NationBudgetChanged } from "../src/index.js";

export const asSafeInt = (value: number): SafeInt => value as SafeInt;

export function budgetEvent(
  overrides: Partial<DomainEventEnvelope<NationBudgetChanged>> = {},
): DomainEventEnvelope<NationBudgetChanged> {
  return {
    eventId: "evt-1",
    version: "1",
    aggregateType: "Nation",
    aggregateId: "nation-1",
    eventType: "NationBudgetChanged",
    timestamp: "2026-08-16T12:00:00.000Z",
    sequenceNumber: asSafeInt(1),
    body: {
      kind: "NationBudgetChanged",
      nationId: "nation-1",
      previousTreasury: asSafeInt(100),
      newTreasury: asSafeInt(90),
      delta: asSafeInt(-10),
      reason: "construction",
    },
    ...overrides,
  };
}
