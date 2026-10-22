import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  assertPressureNotExposed,
  buildMineKnowledgeAssertion,
  clearLaneInKnowledge,
  computeMineKnowledgeAssertionHash,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  recordSweepObservation,
  type AreaMinePressureRecord,
  verifyMineKnowledgeAssertionHash,
  visiblePressureTo,
  withAreaMinePressureRecordHash,
  withMineKnowledgeAssertionHash,
} from "../../src/mines/index.js";

function pressureRecord(): AreaMinePressureRecord {
  return withAreaMinePressureRecordHash({
    minePressureId: "mp_white_sea_south.us_2",
    areaId: "white_sea_south",
    layingParticipantId: "USSR",
    targetBelligerents: ["u002"],
    mineTypeId: "CONTACT" as const,
    pressure: SafeInt(400_000),
    freshnessBp: SafeInt(5_000),
    sourceComposition: [{ layingSourceId: "port_soroka", contributingValue: 400_000, count: 1 }],
    mineCountOrAbstractedEquivalent: SafeInt(2_000),
    detectionConfidenceRecords: [],
    creationMonth: SafeInt(31),
    lastReinforcedMonth: SafeInt(31),
    lastDecayedMonth: SafeInt(35),
    lastSweptMonth: SafeInt(38),
    legalOwnerOfSourceFacilities: "USSR",
    militaryControllerOfSourceFacilities: "USSR",
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  });
}

function usKnowledge() {
  return buildMineKnowledgeAssertion({
    areaId: "white_sea_south",
    participantId: "u002",
    suspectedAreaOrRoute: "northern approach lanes",
    estimatedPressureIntervalBp: [250_000, 350_000],
    estimatedMineType: "CONTACT",
    suspectedLayingParticipantId: "USSR",
    knownClearedLanes: ["lane_1"],
    freshnessEstimateBp: 5_000,
    lastObservedOrSweptMonth: SafeInt(40),
  });
}

describe("AC-18: knowledge is a DISTINCT record type from AreaMinePressureRecord", () => {
  it("a knowledge assertion is never shaped like a pressure record (no pressure field)", () => {
    const k = usKnowledge();
    expect(k).not.toHaveProperty("pressure");
    expect(k).not.toHaveProperty("sourceComposition");
    expect(k).not.toHaveProperty("recordHash");
    expect(k).toHaveProperty("knowledgeHash");
    expect(k).toHaveProperty("estimatedPressureIntervalBp");
  });

  it("builds a per-participant assertion with deterministic hash", () => {
    const k = usKnowledge();
    expect(k.participantId).toBe("u002");
    expect(k.suspectedAreaOrRoute).toBe("northern approach lanes");
    expect([...k.estimatedPressureIntervalBp]).toEqual([250_000, 350_000]);
    expect(k.estimatedMineType).toBe("CONTACT");
    expect(k.suspectedLayingParticipantId).toBe("USSR");
    expect([...k.knownClearedLanes]).toEqual(["lane_1"]);
    expect(k.knowledgeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyMineKnowledgeAssertionHash(k)).toBe(true);
  });

  it("identical inputs produce identical knowledge hashes", () => {
    expect(computeMineKnowledgeAssertionHash(usKnowledge())).toBe(
      computeMineKnowledgeAssertionHash(usKnowledge()),
    );
    const k = usKnowledge();
    const rebuilt = withMineKnowledgeAssertionHash({ ...k });
    expect(rebuilt.knowledgeHash).toBe(k.knowledgeHash);
  });

  it("explicit defaults: unknown until first observed", () => {
    const k = buildMineKnowledgeAssertion({
      areaId: "a",
      participantId: "p",
      suspectedAreaOrRoute: "route",
      estimatedPressureIntervalBp: [0, 0],
      estimatedMineType: "UNKNOWN",
      suspectedLayingParticipantId: "UNKNOWN",
    });
    expect(k.freshnessEstimateBp).toBe(0);
    expect(k.lastObservedOrSweptMonth).toBe(SafeInt(0));
    expect([...k.knownClearedLanes]).toEqual([]);
  });
});

describe("AC-18: TRUE pressure must NOT be exposed without a source policy", () => {
  it("no source policy -> returns the ESTIMATE, never the true number", () => {
    const r = pressureRecord();
    const k = usKnowledge();
    const v = visiblePressureTo(r, k, false);
    expect(v.exactValueExposed).toBe(false);
    expect(v.exposedTruePressure).toBeNull();
    expect([...v.estimatedPressureIntervalBp]).toEqual([250_000, 350_000]);
  });

  it("assertPressureNotExposed does the same guard", () => {
    const r = pressureRecord();
    const k = usKnowledge();
    const v = assertPressureNotExposed(r, k, false);
    expect(v.exposedTruePressure).toBeNull();
    expect(v.exactValueExposed).toBe(false);
    expect(v.estimatedPressureIntervalBp[1]).not.toBe(400_000);
  });

  it("sourcePolicyPermitsValue === true exposes the true pressure", () => {
    const r = pressureRecord();
    const k = usKnowledge();
    const v = visiblePressureTo(r, k, true);
    expect(v.exactValueExposed).toBe(true);
    expect(v.exposedTruePressure).toBe(SafeInt(400_000));
  });
});

describe("AC-18: sweeping improves knowledge ONLY through explicit sweep-observation records", () => {
  it("recordSweepObservation merges an explicit observation (lanes, interval, freshness, month)", () => {
    const k = usKnowledge();
    const after = recordSweepObservation(k, {
      observedMonth: SafeInt(41),
      clearedLanes: ["lane_2"],
      observedPressureIntervalBp: [100_000, 180_000],
      observedMineType: "CONTACT",
      observedFreshnessEstimateBp: 4_000,
    });
    expect([...after.knownClearedLanes]).toEqual(["lane_1", "lane_2"]);
    expect([...after.estimatedPressureIntervalBp]).toEqual([100_000, 180_000]);
    expect(after.freshnessEstimateBp).toBe(4_000);
    expect(after.lastObservedOrSweptMonth).toBe(SafeInt(41));
    expect(after.estimatedMineType).toBe("CONTACT");
    expect(verifyMineKnowledgeAssertionHash(after)).toBe(true);
  });

  it("observed cleared lanes are appended (deduplicated), never shadow-inferred", () => {
    const k = usKnowledge();
    const after = recordSweepObservation(k, {
      observedMonth: SafeInt(42),
      clearedLanes: ["lane_1", "lane_3"],
      observedPressureIntervalBp: [90_000, 120_000],
      observedMineType: "UNKNOWN",
      observedFreshnessEstimateBp: 3_000,
    });
    expect([...after.knownClearedLanes]).toEqual(["lane_1", "lane_3"]);
  });

  it("clearLaneInKnowledge adds a known cleared lane independently", () => {
    const k = usKnowledge();
    const after = clearLaneInKnowledge(k, "lane_9");
    expect([...after.knownClearedLanes]).toEqual(["lane_1", "lane_9"]);
  });

  it("knowledge improvements are per-participant (map keyed by participantId)", () => {
    const p1 = usKnowledge();
    const p2 = buildMineKnowledgeAssertion({
      areaId: "white_sea_south",
      participantId: "u005",
      suspectedAreaOrRoute: "western approaches",
      estimatedPressureIntervalBp: [0, 200_000],
      estimatedMineType: "UNKNOWN",
      suspectedLayingParticipantId: "UNKNOWN",
    });
    expect(p1.participantId).not.toBe(p2.participantId);
    expect([...p1.knownClearedLanes]).toEqual(["lane_1"]);
    expect([...p2.knownClearedLanes]).toEqual([]);
  });
});
