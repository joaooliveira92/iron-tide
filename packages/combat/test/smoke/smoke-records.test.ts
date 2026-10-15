import { describe, expect, it } from "vite-plus/test";
import {
  createSmokeEventRecord,
  verifySmokeEventRecordHash,
  assertSmokeEventRecordSurface,
  smokeEventRecordId,
  SMOKE_RECORD_KINDS,
  type SmokeEventRecord,
} from "../../src/smoke/smokeRecords.js";
import { SMOKE_RULESET_VERSION, SMOKE_FORMULA_VERSION } from "../../src/smoke/constants.js";

describe("smokeEventRecordId", () => {
  it("produces deterministic id from fields", () => {
    const id = smokeEventRecordId({
      battleMinute: 100,
      substep: 0,
      kind: "DRIFT_DECAY",
      sourceId: "ship-001",
      cloudId: "cloud-001",
    });
    expect(id).toBe("100:0:smoke_drift_decay:ship-001:cloud-001");
  });

  it("includes discriminator when provided", () => {
    const id = smokeEventRecordId({
      battleMinute: 100,
      substep: 0,
      kind: "DRIFT_DECAY",
      sourceId: "ship-001",
      cloudId: "cloud-001",
      discriminator: "merge-1",
    });
    expect(id).toBe("100:0:smoke_drift_decay:ship-001:cloud-001:merge-1");
  });

  it("same inputs produce same id", () => {
    const a = smokeEventRecordId({
      battleMinute: 5,
      substep: 1,
      kind: "FUNNEL_EMISSION",
      sourceId: "s1",
      cloudId: "c1",
    });
    const b = smokeEventRecordId({
      battleMinute: 5,
      substep: 1,
      kind: "FUNNEL_EMISSION",
      sourceId: "s1",
      cloudId: "c1",
    });
    expect(a).toBe(b);
  });
});

describe("createSmokeEventRecord", () => {
  it("creates a DRIFT_DECAY record with all fields", () => {
    const record = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 42,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "ship-001",
      cloudId: "cloud-abc",
      position: [100, 200] as readonly [number, number],
      densityBp: 7_500,
      weatherContext: { windSpeedKnots: 10, windDirection: 90, precipitationIntensityBp: 5_000 },
    });

    expect(record.kind).toBe("DRIFT_DECAY");
    expect(record.battleMinute).toBe(42);
    expect(record.substep).toBe(0);
    expect(record.sourceType).toBe("FUNNEL");
    expect(record.sourceId).toBe("ship-001");
    expect(record.cloudId).toBe("cloud-abc");
    expect(record.position).toEqual([100, 200]);
    expect(record.densityBp).toBe(7_500);
    expect(record.weatherContext).toEqual({
      windSpeedKnots: 10,
      windDirection: 90,
      precipitationIntensityBp: 5_000,
    });
    expect(record.formulaVersion).toBe(SMOKE_FORMULA_VERSION);
    expect(record.rulesetVersion).toBe(SMOKE_RULESET_VERSION);
    expect(typeof record.recordHash).toBe("string");
    expect(record.recordHash.length).toBeGreaterThan(0);
  });

  it("creates a FUNNEL_EMISSION record", () => {
    const record = createSmokeEventRecord({
      kind: "FUNNEL_EMISSION",
      battleMinute: 10,
      substep: 1,
      sourceType: "FUNNEL",
      sourceId: "ship-002",
      cloudId: "cloud-xyz",
      position: [500, 300] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(record.kind).toBe("FUNNEL_EMISSION");
    expect(record.sourceType).toBe("FUNNEL");
    expect(record.densityBp).toBe(5_000);
  });

  it("creates a SMOKESCREEN_GENERATION record", () => {
    const record = createSmokeEventRecord({
      kind: "SMOKESCREEN_GENERATION",
      battleMinute: 15,
      substep: 0,
      sourceType: "SMOKESCREEN",
      sourceId: "ship-003",
      cloudId: "cloud-sc-1",
      position: [0, 0] as readonly [number, number],
      densityBp: 9_000,
    });

    expect(record.kind).toBe("SMOKESCREEN_GENERATION");
    expect(record.sourceType).toBe("SMOKESCREEN");
  });

  it("creates a FLOAT_DEPLOYMENT record", () => {
    const record = createSmokeEventRecord({
      kind: "FLOAT_DEPLOYMENT",
      battleMinute: 20,
      substep: 0,
      sourceType: "FLOAT",
      sourceId: "ship-004",
      cloudId: "cloud-float-1",
      position: [100, 100] as readonly [number, number],
      densityBp: 8_500,
    });

    expect(record.kind).toBe("FLOAT_DEPLOYMENT");
    expect(record.sourceType).toBe("FLOAT");
  });

  it("creates a GENERATOR_ACTIVATION record", () => {
    const record = createSmokeEventRecord({
      kind: "GENERATOR_ACTIVATION",
      battleMinute: 25,
      substep: 0,
      sourceType: "GENERATOR",
      sourceId: "ship-005",
      cloudId: "cloud-gen-1",
      position: [200, 200] as readonly [number, number],
      densityBp: 9_000,
    });

    expect(record.kind).toBe("GENERATOR_ACTIVATION");
    expect(record.sourceType).toBe("GENERATOR");
  });

  it("creates a SMOKE_SOURCE_REMOVAL record", () => {
    const record = createSmokeEventRecord({
      kind: "SMOKE_SOURCE_REMOVAL",
      battleMinute: 30,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "ship-001",
      cloudId: "cloud-abc",
      position: [150, 250] as readonly [number, number],
      densityBp: 0,
    });

    expect(record.kind).toBe("SMOKE_SOURCE_REMOVAL");
    expect(record.densityBp).toBe(0);
  });

  it("creates a SMOKE_SOURCE_MERGE record", () => {
    const record = createSmokeEventRecord({
      kind: "SMOKE_SOURCE_MERGE",
      battleMinute: 35,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "ship-001",
      cloudId: "cloud-merged",
      position: [75, 75] as readonly [number, number],
      densityBp: 10_000,
    });

    expect(record.kind).toBe("SMOKE_SOURCE_MERGE");
    expect(record.sourceType).toBe("FUNNEL");
  });

  it("each kind has the correct kind string", () => {
    const kindMap: Record<string, string> = {
      DRIFT_DECAY: "DRIFT_DECAY",
      LINE_INTERSECTION: "LINE_INTERSECTION",
      FUNNEL_EMISSION: "FUNNEL_EMISSION",
      SMOKESCREEN_GENERATION: "SMOKESCREEN_GENERATION",
      FLOAT_DEPLOYMENT: "FLOAT_DEPLOYMENT",
      GENERATOR_ACTIVATION: "GENERATOR_ACTIVATION",
      SMOKE_SOURCE_MERGE: "SMOKE_SOURCE_MERGE",
      SMOKE_SOURCE_REMOVAL: "SMOKE_SOURCE_REMOVAL",
    };

    for (const kind of SMOKE_RECORD_KINDS) {
      expect(kindMap[kind]).toBe(kind);
    }
  });

  it("SMOKE_RECORD_KINDS contains exactly 8 entries", () => {
    expect(SMOKE_RECORD_KINDS).toEqual([
      "DRIFT_DECAY",
      "LINE_INTERSECTION",
      "FUNNEL_EMISSION",
      "SMOKESCREEN_GENERATION",
      "FLOAT_DEPLOYMENT",
      "GENERATOR_ACTIVATION",
      "SMOKE_SOURCE_MERGE",
      "SMOKE_SOURCE_REMOVAL",
    ]);
  });

  it("record has deterministic recordHash", () => {
    const record1 = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });
    const record2 = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(record1.recordHash).toBe(record2.recordHash);
  });

  it("fields are immutable after creation (frozen)", () => {
    const record = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(Object.isFrozen(record)).toBe(true);
    expect(() => {
      (record as unknown as Record<string, unknown>).kind = "FUNNEL_EMISSION";
    }).toThrow();
  });

  it("weatherContext is null when not provided", () => {
    const record = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(record.weatherContext).toBeNull();
  });

  it("weatherContext is null when explicitly set to null", () => {
    const record = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
      weatherContext: null,
    });

    expect(record.weatherContext).toBeNull();
  });

  it("record hash changes when density changes", () => {
    const record1 = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });
    const record2 = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 7_500,
    });

    expect(record1.recordHash).not.toBe(record2.recordHash);
  });

  it("record hash changes when position changes", () => {
    const record1 = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });
    const record2 = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [100, 200] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(record1.recordHash).not.toBe(record2.recordHash);
  });

  it("verifySmokeEventRecordHash returns true for valid records", () => {
    const record = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(verifySmokeEventRecordHash(record)).toBe(true);
  });

  it("verifySmokeEventRecordHash returns false for tampered records", () => {
    const record = createSmokeEventRecord({
      kind: "DRIFT_DECAY",
      battleMinute: 1,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });

    const tampered: SmokeEventRecord = { ...record, densityBp: 9_000 };
    expect(verifySmokeEventRecordHash(tampered)).toBe(false);
  });

  it("LINE_INTERSECTION kind is accepted", () => {
    const record = createSmokeEventRecord({
      kind: "LINE_INTERSECTION",
      battleMinute: 50,
      substep: 0,
      sourceType: "FUNNEL",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 3_000,
    });

    expect(record.kind).toBe("LINE_INTERSECTION");
    expect(verifySmokeEventRecordHash(record)).toBe(true);
  });

  it("assertSmokeEventRecordSurface passes for valid record", () => {
    const record = createSmokeEventRecord({
      kind: "SMOKESCREEN_GENERATION",
      battleMinute: 1,
      substep: 0,
      sourceType: "SMOKESCREEN",
      sourceId: "s1",
      cloudId: "c1",
      position: [0, 0] as readonly [number, number],
      densityBp: 5_000,
    });

    expect(() => assertSmokeEventRecordSurface(record)).not.toThrow();
  });
});
