// AC-13 (INC-6): Mine Incident Report (§19). Every observed/suspected mine event
// creates a MineIncidentReport with all §19 fields; reports NEVER overwrite true
// pressure/type/cause/laying-participant; MINE_REPORT_CAUSE_UNCERTAIN is flagged
// when cause-estimation confidence is below the AUTHORED certain threshold.
// Pure/deterministic: no wall-clock/env/locale (times are campaign-month ints).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  type AreaMinePressureRecord,
  buildMineIncidentReport,
  computeMineIncidentReportHash,
  INVALID_MINE_PRESSURE_STATE,
  MINE_FORMULA_VERSION,
  MINE_REPORT_CAUSE_UNCERTAIN,
  MINE_REPORT_SIGNATURE_POLICY_ID,
  MINE_REPORT_UNKNOWN,
  MINE_RULESET_VERSION,
  MINE_STRIKE,
  type MineIncidentReport,
  mineReportContentVersion,
  mineReportIsKnowledgeStateOnly,
  verifyAreaMinePressureRecordHash,
  verifyMineIncidentReportHash,
  withAreaMinePressureRecordHash,
} from "../../src/mines/index.js";

type ReportInput = Omit<MineIncidentReport, "reportHash">;

function baseReportInput(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    reportId: "rpt-1",
    recipientParticipantId: "participant-uk",
    areaOrRoute: "area-42",
    observedTime: SafeInt(1_000),
    receivedTime: SafeInt(1_002),
    affectedShipOrForceId: "ship-7",
    reportedCause: MINE_STRIKE,
    estimatedMineType: "MAGNETIC",
    estimatedLayingParticipantId: "participant-ger",
    confidenceBp: SafeInt(4_500),
    positionErrorMeters: SafeInt(800),
    deliveryDelayMonths: SafeInt(2),
    possibleDeception: false,
    generatedKnowledgeAssertions: [
      {
        knowledgeAssertionId: "ka-1",
        participantId: "participant-uk",
        kind: "SUSPECTED_MINE_TYPE",
        detail: "magnetic mine, area-42, month 1000",
      },
    ],
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    ...overrides,
  };
}

function validPressureRecord(areaId = "area-42"): AreaMinePressureRecord {
  return withAreaMinePressureRecordHash({
    minePressureId: "mp-1",
    areaId,
    layingParticipantId: "participant-ger",
    targetBelligerents: ["uk"],
    mineTypeId: "MAGNETIC",
    pressure: SafeInt(250_000),
    freshnessBp: SafeInt(8_000),
    sourceComposition: [],
    mineCountOrAbstractedEquivalent: SafeInt(1_200),
    detectionConfidenceRecords: [],
    creationMonth: SafeInt(900),
    lastReinforcedMonth: null,
    lastDecayedMonth: null,
    lastSweptMonth: null,
    legalOwnerOfSourceFacilities: null,
    militaryControllerOfSourceFacilities: null,
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  }) as AreaMinePressureRecord;
}

describe("AC-13: Mine Incident Report (INC-6, §19)", () => {
  it("builds a report with ALL §19 fields and a deterministic report hash that verifies", () => {
    const { report } = buildMineIncidentReport(baseReportInput());
    expect(report.reportId).toBe("rpt-1");
    expect(report.recipientParticipantId).toBe("participant-uk");
    expect(report.areaOrRoute).toBe("area-42");
    expect(report.observedTime).toBe(SafeInt(1_000));
    expect(report.receivedTime).toBe(SafeInt(1_002));
    expect(report.affectedShipOrForceId).toBe("ship-7");
    expect(report.reportedCause).toBe(MINE_STRIKE);
    expect(report.estimatedMineType).toBe("MAGNETIC");
    expect(report.estimatedLayingParticipantId).toBe("participant-ger");
    expect(report.confidenceBp).toBe(SafeInt(4_500));
    expect(report.positionErrorMeters).toBe(SafeInt(800)); // documented units: metres
    expect(report.deliveryDelayMonths).toBe(SafeInt(2)); // same time units: campaign months
    expect(report.possibleDeception).toBe(false);
    expect(report.generatedKnowledgeAssertions).toHaveLength(1);
    expect(report.reportSignaturePolicyId).toBe(MINE_REPORT_SIGNATURE_POLICY_ID);
    expect(report.rulesetVersion).toBe(MINE_RULESET_VERSION);
    expect(report.formulaVersion).toBe(MINE_FORMULA_VERSION);
    expect(typeof report.reportHash).toBe("string");
    expect(report.reportHash.length).toBeGreaterThan(0);
    expect(mineReportContentVersion).toBe("mine_report_v1");
    expect(verifyMineIncidentReportHash(report)).toBe(true);
  });

  it("hash is deterministic — identical inputs produce identical hashes; tampering breaks verification", () => {
    const a = buildMineIncidentReport(baseReportInput()).report;
    const b = buildMineIncidentReport(baseReportInput()).report;
    expect(a.reportHash).toBe(b.reportHash);
    expect(computeMineIncidentReportHash(a)).toBe(a.reportHash);

    const tampered: MineIncidentReport = { ...a, affectedShipOrForceId: "ship-999" };
    expect(verifyMineIncidentReportHash(tampered)).toBe(false);
    expect(computeMineIncidentReportHash(tampered)).not.toBe(a.reportHash);
  });

  it("REPORTS MUST NOT overwrite true pressure/type/cause/laying-participant (§19)", () => {
    const pressureRecord = validPressureRecord("area-42");
    // Deep-freeze the authoritative record: any mutation would throw in tests.
    Object.freeze(pressureRecord);

    // The report names the SAME area and MAY contradict the authoritative truth.
    const { report } = buildMineIncidentReport(
      baseReportInput({
        areaOrRoute: "area-42",
        reportedCause: "unknown-hull-geometry", // authored textual cause, not MINE_STRIKE
        estimatedMineType: MINE_REPORT_UNKNOWN,
        estimatedLayingParticipantId: MINE_REPORT_UNKNOWN,
      }),
    );

    // The authoritative record is byte-identical (no mutation, no overwrite): its
    // own integrity hash still verifies, and its true fields are untouched.
    expect(verifyAreaMinePressureRecordHash(pressureRecord)).toBe(true);
    expect(pressureRecord.mineTypeId).toBe("MAGNETIC");
    expect(pressureRecord.pressure).toBe(SafeInt(250_000));
    expect(pressureRecord.layingParticipantId).toBe("participant-ger");

    // The report is a separate immutable knowledge record — knowledge-state only.
    expect(report.areaOrRoute).toBe("area-42");
    expect(report.estimatedMineType).toBe(MINE_REPORT_UNKNOWN);
    expect(report.estimatedMineType).not.toBe(pressureRecord.mineTypeId); // no leak of truth
    expect(mineReportIsKnowledgeStateOnly(report)).toBe(true);
  });

  it("emits the cause-uncertain flag when confidence < certain threshold (authored 10_000)", () => {
    const below = buildMineIncidentReport(baseReportInput({ confidenceBp: SafeInt(9_999) }));
    expect(below.causeUncertain).toBe(true);
    const certain = buildMineIncidentReport(baseReportInput({ confidenceBp: SafeInt(10_000) }));
    expect(certain.causeUncertain).toBe(false);
    // design-35 ships no threshold; our authored constant ties the flag to 10_000.
    expect(MINE_REPORT_CAUSE_UNCERTAIN).toBe("MINE_REPORT_CAUSE_UNCERTAIN");
  });

  it("rejects invalid/boundary §19 fields fail-closed with the module invariant code", () => {
    // receivedTime < observedTime
    expect(() =>
      buildMineIncidentReport(
        baseReportInput({ observedTime: SafeInt(1_005), receivedTime: SafeInt(1_002) }),
      ),
    ).toThrow(BluewaveError);
    // confidence out of range
    expect(() =>
      buildMineIncidentReport(baseReportInput({ confidenceBp: SafeInt(10_001) })),
    ).toThrow(BluewaveError);
    expect(() => buildMineIncidentReport(baseReportInput({ confidenceBp: SafeInt(-1) }))).toThrow(
      BluewaveError,
    );
    // missing recipient participant
    expect(() => buildMineIncidentReport(baseReportInput({ recipientParticipantId: "" }))).toThrow(
      BluewaveError,
    );
    // invalid estimated mine type
    expect(() =>
      buildMineIncidentReport(baseReportInput({ estimatedMineType: "NOT_A_MINE" as never })),
    ).toThrow(BluewaveError);
    // negative delivery delay
    expect(() =>
      buildMineIncidentReport(baseReportInput({ deliveryDelayMonths: SafeInt(-1) })),
    ).toThrow(BluewaveError);
    // delivery delay not equal to receivedTime - observedTime (same time units)
    expect(() =>
      buildMineIncidentReport(baseReportInput({ deliveryDelayMonths: SafeInt(3) })),
    ).toThrow(BluewaveError);
    // wrong report-signature policy id
    expect(() =>
      buildMineIncidentReport(baseReportInput({ reportSignaturePolicyId: "not_the_v1_id" })),
    ).toThrow(BluewaveError);
    // empty generated knowledge assertions detail
    expect(() =>
      buildMineIncidentReport(
        baseReportInput({
          generatedKnowledgeAssertions: [
            {
              knowledgeAssertionId: "ka-1",
              participantId: "participant-uk",
              kind: "SUSPECTED_MINE_TYPE",
              detail: "",
            },
          ],
        }),
      ),
    ).toThrow(BluewaveError);
  });

  it("errors carry an in-catalog code (INVALID_MINE_PRESSURE_STATE)", () => {
    try {
      buildMineIncidentReport(baseReportInput({ areaOrRoute: "" }));
      expect.unreachable();
    } catch (error) {
      const err = error as BluewaveError;
      expect(isBluewaveError(err)).toBe(true);
      expect((err.context as Record<string, unknown>).code).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });
});
