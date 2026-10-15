import type { CommandRecord } from "@bluewave/commands";
import { describe, expect, it } from "vite-plus/test";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { campaignMonthKey, toWorkEnvelope, withRecordStatus } from "./commandRecord.js";
import { ConstructionWorkspace } from "./workspaceState.js";

const RECORD = {
  commandId: "cmd-1",
  commandTypeId: "construction_order",
  commandSchemaVersion: "1.0.0",
  campaignId: "camp-1",
  issuerClass: "PLAYER",
  issuerParticipantId: "uk",
  targetAggregateId: "uk",
  submissionPhaseId: "construction_submission",
  submissionOrdinal: 1,
  idempotencyKey: "req-1",
  canonicalPayloadHash: "deadbeef",
  status: "SUBMITTED",
  commandHash: "initial",
} as unknown as CommandRecord;

describe("withRecordStatus", () => {
  it("sets the status and recomputes a deterministic, timestamp-free hash", () => {
    const a = withRecordStatus(RECORD, "ACCEPTED");
    const b = withRecordStatus(RECORD, "ACCEPTED");
    expect(a.status).toBe("ACCEPTED");
    expect(a.commandHash).not.toBe("initial");
    expect(a.commandHash).toBe(b.commandHash);
  });
});

describe("campaignMonthKey", () => {
  it("zero-pads the calendar month", () => {
    const record = { month: { year: 1880, month: 3 } } as unknown as CampaignSessionRecord;
    expect(campaignMonthKey(record)).toBe("1880-03");
  });
});

describe("toWorkEnvelope", () => {
  it("derives a deterministic timestamp and transports the work body", () => {
    const workspace = new ConstructionWorkspace("session-1", "uk", 0, 0);
    const envelope = toWorkEnvelope(
      workspace,
      "cmd-1",
      "req-1",
      3,
      "uk",
      "des-1",
      119,
      2,
      "snap-hash",
    );
    expect(envelope.timestamp).toBe("session-1:cmd-1");
    expect(envelope.idempotencyKey).toBe("req-1");
    expect(envelope.expectedSnapshotHash).toBe("snap-hash");
    expect(envelope.body).toMatchObject({
      type: "construction_order",
      designId: "des-1",
      projectedCost: 119,
    });
  });
});
