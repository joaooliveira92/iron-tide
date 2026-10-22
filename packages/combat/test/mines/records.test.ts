import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { SafeInt } from "@bluewave/contracts";
import {
  assembleMineWarfareResolutionRecord,
  computeMineWarfareResolutionRecordHash,
  MINE_RESOLUTION_POLICY_ID,
  MINE_RESOLUTION_RULESET_VERSION,
  MINE_RESOLUTION_FORMULA_VERSION,
  mineWarfareResolutionPolicyId,
  SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT,
  validateMineWarfareResolutionContract,
  verifyMineWarfareResolutionRecordHash,
  type MineWarfareResolutionAssemblerInput,
} from "../../src/mines/index.js";
import { withAreaMinePressureRecordHash } from "../../src/mines/index.js";

function baseInput(
  overrides?: Partial<MineWarfareResolutionAssemblerInput>,
): MineWarfareResolutionAssemblerInput {
  const opening = withAreaMinePressureRecordHash({
    minePressureId: "MP-1",
    areaId: "A-1",
    layingParticipantId: "P-1",
    targetBelligerents: ["B2"],
    mineTypeId: "CONTACT",
    pressure: SafeInt(100_000),
    freshnessBp: SafeInt(8_000),
    sourceComposition: [{ layingSourceId: "P1:SRC", contributingValue: 100_000, count: 1 }],
    mineCountOrAbstractedEquivalent: SafeInt(10),
    detectionConfidenceRecords: [],
    creationMonth: SafeInt(1),
    lastReinforcedMonth: null,
    lastDecayedMonth: null,
    lastSweptMonth: null,
    legalOwnerOfSourceFacilities: "P1",
    militaryControllerOfSourceFacilities: "P1",
    rulesetVersion: MINE_RESOLUTION_RULESET_VERSION,
    formulaVersion: MINE_RESOLUTION_FORMULA_VERSION,
  });
  const input: MineWarfareResolutionAssemblerInput = {
    month: SafeInt(12),
    areaAndWarContexts: [
      { areaId: "A-1", warIds: ["W1"] },
      { areaId: "A-2", warIds: ["W1", "W2"] },
    ],
    openingPressureRecords: [opening],
    layingSourcesAndValues: [
      { source: "P1:SRC-1", layingParticipant: "P1", area: "A-1", value: 100, month: SafeInt(11) },
    ],
    sweepingShipsModesValues: [
      { shipId: "S-1", equipmentMode: "SINGLE_PURPOSE", sweepingValue: 80 },
    ],
    dualEquipmentReductions: [],
    allocatedSweeping: [
      {
        minePressureId: "MP-1",
        sweptPressure: SafeInt.ZERO,
        typeAdjustedSweeping: SafeInt(80),
        pressureAfter: SafeInt(100_000),
        mineTypeId: "CONTACT",
        threatensSweepingSide: false,
        strikeRiskPriority: 0,
      },
    ],
    pressureRemoved: SafeInt(0),
    routes: [{ routeEdgeId: "EDGE-1", routeRiskBp: SafeInt(120) }],
    battle: [],
    strikeDecisionsAndOutcomes: [],
    standoffLevels: [{ minePressureId: "MP-1", level: 1, utilityMultiplierBp: 9_000 }],
    decay: [
      {
        minePressureId: "MP-1",
        retentionMultiplierBp: 9_750,
        decayedPressure: SafeInt(2_500),
        pressureAfterDecay: SafeInt(97_500),
      },
    ],
    postWarAndOwnershipDispositions: [{ minePressureId: "MP-1", disposition: "PRESERVE_ACTIVE" }],
    reportsAndKnowledgeChanges: [{ reportId: "R-1", participantId: "P2" }],
    friendlyFireChecks: [],
    inventoryWarScorePoliticalAndDamageEffects: [
      { ordinal: 1, stableId: "warsrc:P1:+1", description: "war score +1" },
    ],
    rngDecisions: [],
  };
  return overrides ? { ...input, ...overrides } : input;
}

describe("AC-20: §28 MineWarfareResolutionRecord (all fields, immutable, one per resolution)", () => {
  it("assembles one immutable record carrying every §28 field group", () => {
    const record = assembleMineWarfareResolutionRecord(baseInput());
    expect(record.month).toBe(SafeInt(12));
    expect(record.areaAndWarContexts.map((c) => c.areaId)).toEqual(["A-1", "A-2"]);
    expect(record.openingPressureRecords[0]!.minePressureId).toBe("MP-1");
    expect(record.layingSourcesAndValues[0]!.source).toBe("P1:SRC-1");
    expect(record.layingSourcesAndValues[0]!.value).toBe(100);
    expect(record.sweepingShipsModesValues[0]!.shipId).toBe("S-1");
    expect(record.dualEquipmentReductions).toEqual([]);
    expect(record.allocatedSweeping[0]!.minePressureId).toBe("MP-1");
    expect(record.pressureRemoved).toBe(SafeInt(0));
    expect(record.battleAndRouteProbabilities.routes[0]!.routeRiskBp).toBe(SafeInt(120));
    expect(record.battleAndRouteProbabilities.battle).toEqual([]);
    expect(record.standoffLevels[0]!.level).toBe(1);
    expect(record.decay[0]!.retentionMultiplierBp).toBe(9_750);
    expect(record.postWarAndOwnershipDispositions[0]!.disposition).toBe("PRESERVE_ACTIVE");
    expect(record.reportsAndKnowledgeChanges[0]!.reportId).toBe("R-1");
    expect(record.friendlyFireChecks).toEqual([]);
    expect(record.inventoryWarScorePoliticalAndDamageEffects[0]!.ordinal).toBe(1);
    expect(record.rngDecisions).toEqual([]);
    expect(record.rulesetVersion).toBe(MINE_RESOLUTION_RULESET_VERSION);
    expect(record.formulaVersion).toBe(MINE_RESOLUTION_FORMULA_VERSION);
    expect(record.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deeply frozen (immutable)", () => {
    const record = assembleMineWarfareResolutionRecord(baseInput());
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.areaAndWarContexts)).toBe(true);
    expect(() => {
      (record as { month: SafeInt }).month = SafeInt(99);
    }).toThrow(TypeError);
  });

  it("the record hash is deterministic (identical inputs -> identical hash)", () => {
    const a = assembleMineWarfareResolutionRecord(baseInput());
    const b = assembleMineWarfareResolutionRecord(baseInput());
    expect(a.recordHash).toBe(b.recordHash);
  });

  it("the hash is independent of input collection order (§29 canonical ordering)", () => {
    const twoRouteInput = (routes: readonly { routeEdgeId: string; routeRiskBp: SafeInt }[]) =>
      baseInput({ routes });
    const ordered = assembleMineWarfareResolutionRecord(
      twoRouteInput([
        { routeEdgeId: "EDGE-1", routeRiskBp: SafeInt(120) },
        { routeEdgeId: "EDGE-0", routeRiskBp: SafeInt(10) },
      ]),
    );
    expect(ordered.battleAndRouteProbabilities.routes.map((r) => r.routeEdgeId)).toEqual([
      "EDGE-0",
      "EDGE-1",
    ]);
    const shuffled = assembleMineWarfareResolutionRecord(
      baseInput({
        routes: [
          { routeEdgeId: "EDGE-0", routeRiskBp: SafeInt(10) },
          { routeEdgeId: "EDGE-1", routeRiskBp: SafeInt(120) },
        ],
      }),
    );
    expect(shuffled.recordHash).toBe(ordered.recordHash);
  });

  it("warIds inside each area context are canonically sorted (§29 item 1)", () => {
    const ctxOrderA = baseInput({
      areaAndWarContexts: [
        { areaId: "B-ZONE", warIds: ["W2", "W1", "W3"] },
        { areaId: "A-ZONE", warIds: ["W3"] },
      ],
    });
    const ctxOrderB = baseInput({
      areaAndWarContexts: [
        { areaId: "A-ZONE", warIds: ["W3"] },
        { areaId: "B-ZONE", warIds: ["W3", "W2", "W1"] },
      ],
    });
    const a = assembleMineWarfareResolutionRecord(ctxOrderA);
    const b = assembleMineWarfareResolutionRecord(ctxOrderB);
    expect(a.areaAndWarContexts.map((c) => c.areaId)).toEqual(["A-ZONE", "B-ZONE"]);
    const bZone = a.areaAndWarContexts.find((c) => c.areaId === "B-ZONE")!;
    expect([...bZone.warIds]).toEqual(["W1", "W2", "W3"]);
    expect(a.recordHash).toBe(b.recordHash);
  });

  it("allocatedSweeping keeps §10 allocation order, NOT minePressureId order (§29 item 6)", () => {
    const allocations = (order: "input-as-given" | "reversed-caller") =>
      baseInput({
        allocatedSweeping:
          order === "input-as-given"
            ? [
                {
                  minePressureId: "MP-A",
                  sweptPressure: SafeInt(50),
                  typeAdjustedSweeping: SafeInt(80),
                  pressureAfter: SafeInt(20),
                  mineTypeId: "CONTACT",
                  threatensSweepingSide: false,
                  strikeRiskPriority: 0,
                },
                {
                  minePressureId: "MP-B",
                  sweptPressure: SafeInt(0),
                  typeAdjustedSweeping: SafeInt(120),
                  pressureAfter: SafeInt(300),
                  mineTypeId: "CONTROLLED_DEFENSIVE",
                  threatensSweepingSide: true,
                  strikeRiskPriority: 9_000,
                },
              ]
            : [
                {
                  minePressureId: "MP-B",
                  sweptPressure: SafeInt(0),
                  typeAdjustedSweeping: SafeInt(120),
                  pressureAfter: SafeInt(300),
                  mineTypeId: "CONTROLLED_DEFENSIVE",
                  threatensSweepingSide: true,
                  strikeRiskPriority: 9_000,
                },
                {
                  minePressureId: "MP-A",
                  sweptPressure: SafeInt(50),
                  typeAdjustedSweeping: SafeInt(80),
                  pressureAfter: SafeInt(20),
                  mineTypeId: "CONTACT",
                  threatensSweepingSide: false,
                  strikeRiskPriority: 0,
                },
              ],
      });
    const a = assembleMineWarfareResolutionRecord(allocations("input-as-given"));
    const b = assembleMineWarfareResolutionRecord(allocations("reversed-caller"));
    expect(a.allocatedSweeping.map((x) => x.minePressureId)).toEqual(["MP-B", "MP-A"]);
    expect(a.recordHash).toBe(b.recordHash);
  });

  it("verifyMineWarfareResolutionRecordHash recomputes + tamps fails", () => {
    const record = assembleMineWarfareResolutionRecord(baseInput());
    expect(verifyMineWarfareResolutionRecordHash(record)).toBe(true);
    const tampered = { ...record, month: SafeInt(13) };
    expect(verifyMineWarfareResolutionRecordHash(tampered)).toBe(false);
    expect(computeMineWarfareResolutionRecordHash(tampered)).not.toBe(record.recordHash);
  });

  it("fails closed on a non-empty deferred battle/strike/friendly-fire collection", () => {
    const battleAttempt = baseInput({
      battle: [{ battleId: "B-1", targetId: "S-1", hazardBp: SafeInt(1) }],
    });
    expect(() => assembleMineWarfareResolutionRecord(battleAttempt)).toThrow(BluewaveError);
    const strikeAttempt = baseInput({
      strikeDecisionsAndOutcomes: [
        { targetId: "S-1", decidedOutcome: "DUD", severityBp: SafeInt(0) },
      ],
    });
    expect(() => assembleMineWarfareResolutionRecord(strikeAttempt)).toThrow(BluewaveError);
    const ffAttempt = baseInput({
      friendlyFireChecks: [{ shipId: "S-1", minePressureId: "MP-1", riskBp: SafeInt(1) }],
    });
    expect(() => assembleMineWarfareResolutionRecord(ffAttempt)).toThrow(BluewaveError);
  });

  it("fails closed on malformed field content", () => {
    const badMonth = baseInput({ month: SafeInt(-1) });
    expect(() => assembleMineWarfareResolutionRecord(badMonth)).toThrow(BluewaveError);
    const badPressureId = baseInput({
      allocatedSweeping: [
        {
          minePressureId: "MP-X",
          sweptPressure: SafeInt(-1),
          typeAdjustedSweeping: SafeInt(0),
          pressureAfter: SafeInt(1),
          mineTypeId: "CONTACT",
          threatensSweepingSide: false,
          strikeRiskPriority: 0,
        },
      ],
    });
    expect(() => assembleMineWarfareResolutionRecord(badPressureId)).toThrow(BluewaveError);
  });

  it("ships the mine_warfare_resolution_v1 policy + SHIPPED_*_CONTRACT + validate guard", () => {
    expect(mineWarfareResolutionPolicyId).toBe("mine_warfare_resolution_v1");
    expect(MINE_RESOLUTION_POLICY_ID).toBe("mine_warfare_resolution_v1");
    expect(SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT.policyId).toBe("mine_warfare_resolution_v1");
    expect(() =>
      validateMineWarfareResolutionContract(SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateMineWarfareResolutionContract({
        ...SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT,
        policyId: "x",
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateMineWarfareResolutionContract({
        ...SHIPPED_MINE_WARFARE_RESOLUTION_CONTRACT,
        deferredSubRecordCollections: [],
      }),
    ).toThrow(BluewaveError);
  });
});
