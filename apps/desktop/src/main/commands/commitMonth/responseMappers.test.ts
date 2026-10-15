import { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { toDomainEvents } from "./responseMappers.js";

const envelope = (
  eventType: DomainEventEnvelope["eventType"],
  body: DomainEventEnvelope["body"],
): DomainEventEnvelope => ({
  eventId: `${eventType}-1`,
  version: "0.1.0",
  aggregateType: "construction",
  aggregateId: "con_1",
  eventType,
  timestamp: "1880-02-01T00:00:00.000Z",
  body,
  sequenceNumber: SafeInt(1),
});

describe("toDomainEvents", () => {
  it("describes a rebuilt ship with the ship and both design versions", () => {
    const [event] = toDomainEvents([
      envelope("ShipRebuilt", {
        kind: "ShipRebuilt",
        projectId: "con_rebuild",
        nationId: "GBR",
        shipId: "s1",
        fromDesignVersionId: "d_old",
        toDesignVersionId: "d_new",
      }),
    ]);
    expect(event).toMatchObject({
      id: "ShipRebuilt-1",
      kind: "ShipRebuilt",
      message: "GBR: ship s1 rebuilt from d_old to d_new",
    });
  });

  it("describes construction progress as before", () => {
    const [event] = toDomainEvents([
      envelope("ConstructionProgressed", {
        kind: "ConstructionProgressed",
        projectId: "con_1",
        nationId: "GBR",
        previousWork: SafeInt(2),
        newWork: SafeInt(5),
        workAdded: SafeInt(3),
      }),
    ]);
    expect(event!.message).toBe("GBR: project con_1 work 2 -> 5");
  });

  it("describes a cancelled project with the settlement reason and loss", () => {
    const [event] = toDomainEvents([
      envelope("ConstructionProjectCancelled", {
        kind: "ConstructionProjectCancelled",
        projectId: "con_rebuild",
        nationId: "GBR",
        projectType: "REBUILD",
        consumedWork: SafeInt(4),
        refundedAmount: SafeInt(0),
        lostAmount: SafeInt(4),
        salvageableAmount: SafeInt(0),
        reason: "CANCELLATION_WORK_CONSUMED",
      }),
    ]);
    expect(event).toMatchObject({
      id: "ConstructionProjectCancelled-1",
      kind: "ConstructionProjectCancelled",
      message: "GBR: project con_rebuild cancelled (CANCELLATION_WORK_CONSUMED; 4 lost)",
    });
  });

  it("keeps the order of the events", () => {
    const events = toDomainEvents([
      envelope("BattleResolved", {
        kind: "BattleResolved",
        battleId: "b1",
        winnerId: "A",
        loserId: "B",
      }),
      envelope("TechnologyDiscovered", {
        kind: "TechnologyDiscovered",
        nationId: "GBR",
        techId: "t1",
        researchFieldId: "f",
        discoveryMonth: "1880-02",
        cost: SafeInt(1),
      }),
    ]);
    expect(events.map((e) => e.kind)).toEqual(["BattleResolved", "TechnologyDiscovered"]);
  });
});
