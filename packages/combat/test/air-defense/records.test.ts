import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  AttackType,
  createAirDefenseEngagementRecord,
  createLightAaDisruptionOpportunityRecord,
  verifyAirDefenseEngagementRecordHash,
  assertAirDefenseEngagementRecordHash,
  computeAirDefenseEngagementRecordHash,
  airDefenseOutcomeOrdinal,
  AIR_DEFENSE_INVARIANT_FAILED,
  AIR_DEFENSE_FORMULA_VERSION,
  AIR_DEFENSE_MODEL_VERSION,
  AIR_DEFENSE_RECORD_POLICY_ID,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
} from "../../src/air-defense/index.js";
import type { AirDefenseEngagementRecord } from "../../src/air-defense/index.js";

function makeRecordParams(overrides: Record<string, unknown> = {}) {
  return {
    recordId: "rec-ad-001",
    minute: SafeInt(12),
    substep: SafeInt(1),
    defenderId: "ship_001",
    attackerId: "frm_lvl_001",
    attackId: "atk_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    attackProfile: "LEVEL",
    layer: "HEAVY_AA",
    defenseSystemId: "sys_heavy_01",
    directorChannelId: "dir_01",
    radarChannelId: "radar_01",
    directorFactorBp: SafeInt(31_000),
    radarFactorBp: SafeInt(10_000),
    saturationFactorBp: SafeInt(10_000),
    crewQuality: SafeInt(10_000),
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt(10_000),
    roundsRemaining: SafeInt(1_000),
    roundsConsumed: SafeInt(4),
    ammunitionMultiplierBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(120_000),
    windowMilliseconds: SafeInt(0),
    effectiveKillBp: SafeInt(380),
    effectiveDamageBp: SafeInt(190),
    effectiveAbortBp: SafeInt(114),
    effectiveDisruptionBp: SafeInt(57),
    draw: SafeInt(123),
    outcome: "DAMAGE",
    disruptionSeverity: null,
    threatReleased: false,
    threatFormationSize: SafeInt(2),
    reasonCode: "AIR_DEFENSE_CHANNEL_UNAVAILABLE",
    outcomeOrdinal: airDefenseOutcomeOrdinal("DAMAGE"),
    recordKind: "ENGAGEMENT",
    modelVersion: AIR_DEFENSE_MODEL_VERSION,
    formulaVersion: AIR_DEFENSE_FORMULA_VERSION,
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}): AirDefenseEngagementRecord {
  return createAirDefenseEngagementRecord(
    makeRecordParams(overrides) as Parameters<typeof createAirDefenseEngagementRecord>[0],
  );
}

describe("AC-15: AirDefenseEngagementRecord (§26)", () => {
  it("creates a record with all §26 fields and a non-empty deterministic recordHash", () => {
    const record = makeRecord();
    expect(record.recordId).toBe("rec-ad-001");
    expect(Number(record.minute)).toBe(12);
    expect(Number(record.substep)).toBe(1);
    expect(record.defenderId).toBe("ship_001");
    expect(record.attackerId).toBe("frm_lvl_001");
    expect(record.recordHash).toBeTruthy();
    expect(record.recordHash.length).toBe(64);
  });

  it("two identical records produce identical hashes; different fields differ", () => {
    expect(makeRecord().recordHash).toBe(
      createAirDefenseEngagementRecord(
        makeRecordParams() as Parameters<typeof createAirDefenseEngagementRecord>[0],
      ).recordHash,
    );
    expect(makeRecord({ attackId: "atk_002" }).recordHash).not.toBe(makeRecord().recordHash);
  });

  it("computeAirDefenseEngagementRecordHash is deterministic", () => {
    const params = makeRecordParams();
    expect(computeAirDefenseEngagementRecordHash(params as never)).toBe(
      computeAirDefenseEngagementRecordHash(params as never),
    );
  });

  it("records are immutable (Object.freeze)", () => {
    const record = makeRecord();
    expect(Object.isFrozen(record)).toBe(true);
  });

  it("verifyAirDefenseEngagementRecordHash true for valid, false for tampered", () => {
    const record = makeRecord();
    expect(verifyAirDefenseEngagementRecordHash(record)).toBe(true);
    const tampered: AirDefenseEngagementRecord = {
      ...record,
      defenseSystemId: "sys_heavy_02",
    };
    expect(verifyAirDefenseEngagementRecordHash(tampered)).toBe(false);
  });

  it("assertAirDefenseEngagementRecordHash fails tampered records with AIR_DEFENSE_INVARIANT_FAILED", () => {
    const record = makeRecord();
    const tampered: AirDefenseEngagementRecord = { ...record, reasonCode: "TAMPERED" };
    let caught: BluewaveError | null = null;
    try {
      assertAirDefenseEngagementRecordHash(tampered);
    } catch (error) {
      caught = error as BluewaveError;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect(caught?.context.code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
  });

  it("supports every §26 record kind", () => {
    for (const recordKind of [
      "ENGAGEMENT",
      "CAP_INTERCEPTION_INELIGIBLE",
      "CAP_EXHAUSTED",
      "DIRECTOR_ASSIGNMENT",
      "DISRUPTION",
      "CIWS_ENGAGEMENT",
    ]) {
      const record = makeRecord({ recordKind });
      expect(record.recordKind).toBe(recordKind);
      expect(verifyAirDefenseEngagementRecordHash(record)).toBe(true);
    }
  });

  it("handles null director/radar channels", () => {
    const record = makeRecord({ directorChannelId: null, radarChannelId: null });
    expect(record.directorChannelId).toBeNull();
    expect(record.radarChannelId).toBeNull();
    expect(verifyAirDefenseEngagementRecordHash(record)).toBe(true);
  });

  it("carries the full §1 layer union, including the deferred CAP/SAM layers", () => {
    for (const layer of [
      "CAP",
      "HEAVY_SAM",
      "MEDIUM_SAM",
      "LIGHT_SAM",
      "HEAVY_AA",
      "MEDIUM_AA",
      "LIGHT_AA",
      "CIWS_TERMINAL_DEFENSE",
    ]) {
      const record = makeRecord({ layer });
      expect(record.layer).toBe(layer);
      expect(verifyAirDefenseEngagementRecordHash(record)).toBe(true);
    }
  });

  it("pins the record policy id and the model/formula versions into every record", () => {
    const record = makeRecord();
    expect(record.modelVersion).toBe(AIR_DEFENSE_MODEL_VERSION);
    expect(record.formulaVersion).toBe(AIR_DEFENSE_FORMULA_VERSION);
    expect(AIR_DEFENSE_RECORD_POLICY_ID).toBe("air_defense_record_v1");
  });

  describe("outcome-effect ordinals (§27.8)", () => {
    it("orders outcomes by increasing effect strength", () => {
      const cases: Array<[string, number]> = [
        ["INELIGIBLE", 0],
        ["EXHAUSTED", 1],
        ["DIRECTOR_ASSIGNED", 2],
        ["OPPORTUNITY_CREATED", 3],
        ["NO_EFFECT", 4],
        ["DISRUPTION", 5],
        ["ABORT", 6],
        ["DAMAGE", 7],
        ["KILL", 8],
      ];
      for (const [outcome, ordinal] of cases) {
        expect(Number(airDefenseOutcomeOrdinal(outcome as never))).toBe(ordinal);
      }
    });

    it("monotonic: KILL beats DAMAGE beats NO_EFFECT beats OPPORTUNITY_CREATED", () => {
      expect(Number(airDefenseOutcomeOrdinal("KILL"))).toBeGreaterThan(
        Number(airDefenseOutcomeOrdinal("DAMAGE")),
      );
      expect(Number(airDefenseOutcomeOrdinal("DAMAGE"))).toBeGreaterThan(
        Number(airDefenseOutcomeOrdinal("NO_EFFECT")),
      );
      expect(Number(airDefenseOutcomeOrdinal("NO_EFFECT"))).toBeGreaterThan(
        Number(airDefenseOutcomeOrdinal("OPPORTUNITY_CREATED")),
      );
    });
  });

  describe("AC-7 opportunity record factory (§29.8-9)", () => {
    const opportunity = {
      opportunityCreated: true,
      checkMinute: SafeInt(12),
      checkSubstep: SafeInt(1),
      reasonCode: LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
    };

    function opportunityRecord(overrides: Record<string, unknown> = {}) {
      return createLightAaDisruptionOpportunityRecord({
        opportunity,
        recordId: "rec-light-opp-001",
        defenderId: "ship_001",
        attackerId: "frm_lvl_001",
        attackId: "atk_001",
        targetId: "ship_001",
        attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
        attackProfile: "LEVEL",
        defenseSystemId: "sys_light_01",
        directorChannelId: "dir_01",
        radarChannelId: null,
        directorFactorBp: SafeInt(10_000),
        radarFactorBp: SafeInt(10_000),
        saturationFactorBp: SafeInt(10_000),
        crewQuality: SafeInt(10_000),
        damageBp: SafeInt.ZERO,
        powerBp: SafeInt(10_000),
        roundsRemaining: SafeInt(1_000),
        ammunitionMultiplierBp: SafeInt(10_000),
        timeToImpactMs: SafeInt(120_000),
        windowMilliseconds: SafeInt(120_000),
        effectiveKillBp: SafeInt(20),
        effectiveDamageBp: SafeInt(10),
        effectiveAbortBp: SafeInt(5),
        effectiveDisruptionBp: SafeInt(3),
        threatReleased: false,
        threatFormationSize: SafeInt(2),
        ...overrides,
      });
    }

    it("creates an immutable, verifiable record for a GRANTED opportunity", () => {
      const record = opportunityRecord();
      expect(record.recordKind).toBe("LIGHT_AA_DISRUPTION_OPPORTUNITY");
      expect(record.layer).toBe("LIGHT_AA");
      expect(record.outcome).toBe("OPPORTUNITY_CREATED");
      expect(record.minute).toBe(SafeInt(12));
      expect(record.substep).toBe(SafeInt(1));
      expect(record.reasonCode).toBe(LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED);
      expect(Number(record.outcomeOrdinal)).toBe(
        Number(airDefenseOutcomeOrdinal("OPPORTUNITY_CREATED")),
      );
      expect(verifyAirDefenseEngagementRecordHash(record)).toBe(true);
      expect(Object.isFrozen(record)).toBe(true);
    });

    it("guarantees NO ammunition, hit, damage, or abort (§29.9): draw=0, roundsConsumed=0", () => {
      const record = opportunityRecord();
      expect(Number(record.roundsConsumed)).toBe(0);
      expect(Number(record.draw)).toBe(0);
      expect(record.disruptionSeverity).toBeNull();
      expect(record.outcome).toBe("OPPORTUNITY_CREATED");
    });

    it("rejects a NOT-created opportunity with AIR_DEFENSE_INVARIANT_FAILED", () => {
      let caught: BluewaveError | null = null;
      try {
        opportunityRecord({ opportunity: { ...opportunity, opportunityCreated: false } });
      } catch (error) {
        caught = error as BluewaveError;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect(caught?.context.code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
    });
  });
});
