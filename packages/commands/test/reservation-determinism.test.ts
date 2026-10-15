import { describe, it, expect } from "vite-plus/test";
import { ReservationManager } from "../src/reservation.js";
import type { CommandRecord } from "../src/types.js";

function makeCommand(commandId: string): CommandRecord {
  return {
    commandId,
    commandTypeId: "test.command",
    commandSchemaVersion: "0.1.0",
    campaignId: "test-campaign",
    campaignMonth: "1880-01",
    issuerClass: "PLAYER",
    issuerParticipantId: "GBR",
    targetAggregateType: "fleet",
    targetAggregateId: "fleet-1",
    submissionPhaseId: "opening_validation",
    submissionOrdinal: 0,
    idempotencyKey: commandId,
    canonicalPayload: {},
    canonicalPayloadHash: "payload-hash",
    declaredPreconditions: {},
    status: "SUBMITTED",
    reservationRecordIds: [],
    createdFromSnapshotHash: "snapshot-hash",
    lastTransitionAtPhaseId: "opening_validation",
    causalRecordId: "causal-1",
    commandHash: "command-hash",
  };
}

describe("ReservationManager canonical ordering", () => {
  it("orders requirements by UTF-16 codepoint, not host locale (regression: localeCompare)", () => {
    // "STORE:B" precedes "STORE:a" by codepoint ('B' = 66 < 'a' = 97), but the
    // 'en' locale orders "a" before "B". The manager must produce the
    // deterministic order so reservation records never depend on host locale.
    const manager = new ReservationManager();
    manager.registerPool({
      resourceTypeId: "STORE",
      resourceId: "a",
      available: 10,
      reserved: new Map(),
    });
    manager.registerPool({
      resourceTypeId: "STORE",
      resourceId: "B",
      available: 10,
      reserved: new Map(),
    });

    const result = manager.reserve(
      makeCommand("cmd-1"),
      [
        {
          resourceTypeId: "STORE",
          resourceId: "a",
          quantity: 1,
          canonicalUnit: "unit",
          priority: 0,
        },
        {
          resourceTypeId: "STORE",
          resourceId: "B",
          quantity: 1,
          canonicalUnit: "unit",
          priority: 0,
        },
      ],
      "reservation",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) expect.unreachable();
    expect(result.records.map((r) => r.resourceId)).toEqual(["B", "a"]);
  });
});
