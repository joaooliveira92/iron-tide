import { describe, expect, it } from "vite-plus/test";
import { canonicalOrder, normalizeUnorderedSets } from "../src/canonicalization.js";
import type { CommandRecord } from "../src/types.js";

function record(commandId: string, issuerParticipantId: string): CommandRecord {
  return {
    commandId,
    commandTypeId: "test.command",
    commandSchemaVersion: "0.1.0",
    campaignId: "test-campaign",
    campaignMonth: "1880-01",
    issuerClass: "PLAYER",
    issuerParticipantId,
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

describe("canonical command ordering is locale-free", () => {
  it("orders issuers by code unit, so an upper-case id precedes a lower-case one", () => {
    const ordered = canonicalOrder(
      [record("c-1", "alpha"), record("c-2", "Zulu")],
      new Map([["opening_validation", 0]]),
    );

    expect(ordered.map((entry) => entry.issuerParticipantId)).toEqual(["Zulu", "alpha"]);
  });

  it("breaks ties on command id by code unit", () => {
    const ordered = canonicalOrder(
      [record("b-cmd", "GBR"), record("B-cmd", "GBR")],
      new Map([["opening_validation", 0]]),
    );

    expect(ordered.map((entry) => entry.commandId)).toEqual(["B-cmd", "b-cmd"]);
  });

  it("sorts unordered string sets by code unit", () => {
    expect(normalizeUnorderedSets(["b", "A", "a", "B"])).toEqual(["A", "B", "a", "b"]);
  });
});
