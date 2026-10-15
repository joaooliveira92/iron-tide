// AC-23 (INC-7): Aircraft records — creation, hash, verification.
import { describe, expect, it } from "vite-plus/test";
import { createAircraftRecord, verifyAircraftRecordHash } from "../../src/aircraft/records.js";

describe("AC-23: aircraft records", () => {
  it("creates a record with deterministic hash", () => {
    const record = createAircraftRecord({
      recordId: "aircraft_dev_test_1917-06",
      nationId: "nation_france",
      kind: "DEVELOPMENT_COMPLETE",
      entityId: "project_1",
      operation: "development_complete",
      inputHash: "abc123",
      outputHash: "abc123",
      campaignMonth: "1917-06",
      reasonCode: "DEVELOPMENT_COMPLETE",
      rulesetVersion: "aircraft_ruleset_v1",
    });
    expect(record.recordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyAircraftRecordHash(record)).toBe(true);
  });

  it("produces identical hashes for identical inputs", () => {
    const a = createAircraftRecord({
      recordId: "aircraft_dev_test_1917-06",
      nationId: "nation_france",
      kind: "DEVELOPMENT_COMPLETE",
      entityId: "project_1",
      operation: "development_complete",
      inputHash: "abc123",
      outputHash: "abc123",
      campaignMonth: "1917-06",
      reasonCode: "DEVELOPMENT_COMPLETE",
      rulesetVersion: "aircraft_ruleset_v1",
    });
    const b = createAircraftRecord({
      recordId: "aircraft_dev_test_1917-06",
      nationId: "nation_france",
      kind: "DEVELOPMENT_COMPLETE",
      entityId: "project_1",
      operation: "development_complete",
      inputHash: "abc123",
      outputHash: "abc123",
      campaignMonth: "1917-06",
      reasonCode: "DEVELOPMENT_COMPLETE",
      rulesetVersion: "aircraft_ruleset_v1",
    });
    expect(a.recordHash).toBe(b.recordHash);
  });

  it("produces different hashes for different inputs", () => {
    const a = createAircraftRecord({
      recordId: "aircraft_dev_test_1917-06",
      nationId: "nation_france",
      kind: "DEVELOPMENT_COMPLETE",
      entityId: "project_1",
      operation: "development_complete",
      inputHash: "abc123",
      outputHash: "abc123",
      campaignMonth: "1917-06",
      reasonCode: "DEVELOPMENT_COMPLETE",
      rulesetVersion: "aircraft_ruleset_v1",
    });
    const b = createAircraftRecord({
      recordId: "aircraft_dev_test_1917-06",
      nationId: "nation_germany",
      kind: "DEVELOPMENT_COMPLETE",
      entityId: "project_1",
      operation: "development_complete",
      inputHash: "abc123",
      outputHash: "abc123",
      campaignMonth: "1917-06",
      reasonCode: "DEVELOPMENT_COMPLETE",
      rulesetVersion: "aircraft_ruleset_v1",
    });
    expect(a.recordHash).not.toBe(b.recordHash);
  });

  it("fails verification on tampered hash", () => {
    const record = createAircraftRecord({
      recordId: "aircraft_dev_test_1917-06",
      nationId: "nation_france",
      kind: "DEVELOPMENT_COMPLETE",
      entityId: "project_1",
      operation: "development_complete",
      inputHash: "abc123",
      outputHash: "abc123",
      campaignMonth: "1917-06",
      reasonCode: "DEVELOPMENT_COMPLETE",
      rulesetVersion: "aircraft_ruleset_v1",
    });
    const tampered = { ...record, kind: "TAMPERED" };
    expect(verifyAircraftRecordHash(tampered)).toBe(false);
  });
});
