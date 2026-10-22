import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/campaign-engine";
import { dispatchCampaignCommand } from "./campaignBridge.js";
import {
  BattleIdPayloadSchema,
  CampaignConfigurationPayloadSchema,
  CommandEnvelopePayloadSchema,
  DiplomacyCommandBodySchema,
  DivisionCommandBodySchema,
  FirstMonthInspectionSchema,
  GenerateBattlePayloadSchema,
  MonthlyReportsSchema,
  PlaceForeignConstructionCommandPayloadSchema,
  ResolveTacticalBattlePayloadSchema,
  SessionIdPayloadSchema,
  SetResearchPriorityCommandPayloadSchema,
  SubmitDesignCommandPayloadSchema,
  UiStateSchema,
  WriteUiStatePayloadSchema,
} from "../shared/campaignCommandSchemas.js";
import { LoadSaveResultSchema } from "./campaignSaveSchema.js";
import { SessionMetadataSchema } from "./campaignSessionMetadata.js";
import { parseMonthInput } from "./monthInput.js";
import { WriteDrawingBoardDraftPayloadSchema } from "./drawingBoardDraft.js";

function decode<S extends Schema.ConstraintDecoder<unknown, never>>(schema: S, input: unknown) {
  return Schema.decodeUnknownResult(schema)(input);
}

function expectFailure(schema: Schema.ConstraintDecoder<unknown, never>, input: unknown): void {
  expect(Result.isFailure(decode(schema, input))).toBe(true);
}

function expectSuccess<S extends Schema.ConstraintDecoder<unknown, never>>(
  schema: S,
  input: unknown,
): S["Type"] {
  const result = decode(schema, input);
  if (Result.isFailure(result)) {
    throw new Error(
      `expected decode success, got failure: ${JSON.stringify(result.failure.issue)}`,
    );
  }
  return result.success;
}

const VALID_CONFIGURATION = {
  scenarioId: "scen_1880",
  playerSlotId: "uk",
  continuityModeId: "historical",
  fleetSizeSettingId: "standard",
  researchSpeedSettingId: "standard",
  technologyVariationSettingId: "none",
  historicalBudgetOptionId: "balanced",
  legacyFleetModeId: "none",
  tacticalRealismModeId: "standard",
  difficultyProfileId: "normal",
  campaignSeed: "a".repeat(32),
  configurationSchemaVersion: "1.0.0",
} as const;

const VALID_ENVELOPE = {
  sessionId: "s",
  expectedRevision: 0,
  transportRequestId: "req-1",
} as const;

describe("CampaignConfigurationPayloadSchema", () => {
  it("decodes a well-formed configuration", () => {
    expectSuccess(CampaignConfigurationPayloadSchema, VALID_CONFIGURATION);
  });

  it("rejects a missing required field", () => {
    const { playerSlotId: _drop, ...rest } = VALID_CONFIGURATION;
    expectFailure(CampaignConfigurationPayloadSchema, rest);
  });

  it("rejects an unknown enum member", () => {
    expectFailure(CampaignConfigurationPayloadSchema, {
      ...VALID_CONFIGURATION,
      scenarioId: "scen_9999",
    });
  });

  it("rejects an empty string where non-empty is required", () => {
    expectFailure(CampaignConfigurationPayloadSchema, {
      ...VALID_CONFIGURATION,
      configurationSchemaVersion: "",
    });
  });

  it("treats `archetype` as optional (absent and present both decode)", () => {
    expectSuccess(CampaignConfigurationPayloadSchema, VALID_CONFIGURATION);
    expectSuccess(CampaignConfigurationPayloadSchema, {
      ...VALID_CONFIGURATION,
      archetype: "trade",
    });
  });

  it("strips unmodeled keys (z.object parity, not .strict())", () => {
    const decoded = expectSuccess(CampaignConfigurationPayloadSchema, {
      ...VALID_CONFIGURATION,
      unexpected: true,
    });
    expect("unexpected" in decoded).toBe(false);
  });
});

describe("CommandEnvelopePayloadSchema numeric constraints", () => {
  it("accepts a finite non-negative integer revision", () => {
    expectSuccess(CommandEnvelopePayloadSchema, VALID_ENVELOPE);
  });

  for (const expectedRevision of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`rejects expectedRevision=${String(expectedRevision)}`, () => {
      expectFailure(CommandEnvelopePayloadSchema, { ...VALID_ENVELOPE, expectedRevision });
    });
  }

  it("rejects a non-string session id", () => {
    expectFailure(CommandEnvelopePayloadSchema, { ...VALID_ENVELOPE, sessionId: 123 });
  });
});

describe("SessionIdPayloadSchema", () => {
  it("accepts a non-empty string and rejects an empty one", () => {
    expectSuccess(SessionIdPayloadSchema, "session-1");
    expectFailure(SessionIdPayloadSchema, "");
    expectFailure(SessionIdPayloadSchema, { sessionId: 123 });
  });
});

describe("SetResearchPriorityCommandPayloadSchema", () => {
  it("accepts integer priorities within the canonical field cap", () => {
    expectSuccess(SetResearchPriorityCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      fieldPriorities: { GUNNERY: 4 },
    });
  });

  it("rejects a fractional priority", () => {
    expectFailure(SetResearchPriorityCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      fieldPriorities: { GUNNERY: 1.5 },
    });
  });

  it("rejects a non-record fieldPriorities", () => {
    expectFailure(SetResearchPriorityCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      fieldPriorities: "high",
    });
  });

  it("rejects an empty-string field key instead of silently dropping it (13-F2)", () => {
    expectFailure(SetResearchPriorityCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      fieldPriorities: { "": 1, a: 2 },
    });
  });

  it("rejects a record larger than the canonical research field set (refine)", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: CANONICAL_RESEARCH_FIELD_IDS.length + 1 }, (_, i) => [`FIELD_${i}`, 1]),
    );
    expectFailure(SetResearchPriorityCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      fieldPriorities: tooMany,
    });
  });

  it("treats exactTechId as optional", () => {
    expectSuccess(SetResearchPriorityCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      fieldPriorities: { GUNNERY: 4 },
      exactTechId: "basic_steam",
    });
  });
});

describe("DiplomacyCommandBodySchema (tagged union)", () => {
  it("accepts each discriminant shape", () => {
    expectSuccess(DiplomacyCommandBodySchema, { type: "DeclareWar", targetNationId: "fra" });
    expectSuccess(DiplomacyCommandBodySchema, {
      type: "DeclareWar",
      targetNationId: "fra",
      warGoalsId: "goals",
    });
    expectSuccess(DiplomacyCommandBodySchema, { type: "AcceptPeace", warId: "w" });
    expectSuccess(DiplomacyCommandBodySchema, {
      type: "DeclareBlockade",
      targetNationId: "fra",
      areaId: "a",
    });
  });

  it("rejects an unknown discriminant", () => {
    expectFailure(DiplomacyCommandBodySchema, { type: "NotACommand", targetNationId: "fra" });
  });

  it("rejects a member missing a required field", () => {
    expectFailure(DiplomacyCommandBodySchema, { type: "DeclareWar" });
    expectFailure(DiplomacyCommandBodySchema, { type: "DeclareBlockade", targetNationId: "fra" });
  });
});

describe("DivisionCommandBodySchema (tagged union + array bounds)", () => {
  it("accepts a valid reorder within 1..6 ships", () => {
    expectSuccess(DivisionCommandBodySchema, {
      type: "ReorderDivisionShips",
      divisionId: "d",
      shipOrder: ["a"],
    });
    expectSuccess(DivisionCommandBodySchema, {
      type: "ReorderDivisionShips",
      divisionId: "d",
      shipOrder: ["a", "b", "c", "d", "e", "f"],
    });
  });

  it("rejects an empty or oversized ship order", () => {
    expectFailure(DivisionCommandBodySchema, {
      type: "ReorderDivisionShips",
      divisionId: "d",
      shipOrder: [],
    });
    expectFailure(DivisionCommandBodySchema, {
      type: "ReorderDivisionShips",
      divisionId: "d",
      shipOrder: ["a", "b", "c", "d", "e", "f", "g"],
    });
  });

  it("rejects an unknown discriminant", () => {
    expectFailure(DivisionCommandBodySchema, { type: "TeleportDivision", divisionId: "d" });
  });
});

describe("SubmitDesignCommandPayloadSchema (trim + object draft)", () => {
  it("trims className and accepts an object draft", () => {
    const decoded = expectSuccess(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "  Ironclad  ",
      draft: { hull: "x" },
    });
    expect(decoded.className).toBe("Ironclad");
  });

  it("rejects a whitespace-only className", () => {
    expectFailure(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "   ",
      draft: {},
    });
  });

  it("rejects a className longer than 60 characters after trimming", () => {
    expectFailure(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "x".repeat(61),
      draft: {},
    });
  });

  it("rejects a non-object draft", () => {
    expectFailure(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "x",
      draft: null,
    });
    expectFailure(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "x",
      draft: 3,
    });
  });

  it("accepts an array/Date draft (pre-migration z.custom predicate parity, 13-F1)", () => {
    expectSuccess(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "x",
      draft: [{ hull: "x" }],
    });
    expectSuccess(SubmitDesignCommandPayloadSchema, {
      ...VALID_ENVELOPE,
      className: "x",
      draft: new Date(0),
    });
  });
});

describe("UiStateSchema / FirstMonthInspectionSchema", () => {
  it("accepts a valid sidecar with and without inspection state", () => {
    expectSuccess(UiStateSchema, { turnNumber: 1, dismissedFingerprints: [] });
    expectSuccess(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: ["fp"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
    });
  });

  it("accepts an optional inspector layout and rejects a malformed one", () => {
    expectSuccess(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: [],
      inspector: { widthPx: 440, collapsed: false },
    });
    expectFailure(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: [],
      inspector: { widthPx: 440 },
    });
    expectFailure(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: [],
      inspector: { widthPx: "wide", collapsed: false },
    });
    expectFailure(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: [],
      inspector: { widthPx: 300, collapsed: false },
    });
    expectFailure(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: [],
      inspector: { widthPx: 440.5, collapsed: false },
    });
  });

  it("bounds lastCompletedStep to 0..6", () => {
    expectSuccess(FirstMonthInspectionSchema, { status: "completed", lastCompletedStep: 6 });
    expectFailure(FirstMonthInspectionSchema, { status: "completed", lastCompletedStep: 7 });
    expectFailure(FirstMonthInspectionSchema, { status: "completed", lastCompletedStep: -1 });
  });

  it("rejects an unknown status", () => {
    expectFailure(FirstMonthInspectionSchema, { status: "paused", lastCompletedStep: 0 });
  });

  it("caps the fingerprint array at 64 entries and each fingerprint at 256 chars", () => {
    expectFailure(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: Array.from({ length: 65 }, (_, i) => `fp-${i}`),
    });
    expectFailure(UiStateSchema, {
      turnNumber: 1,
      dismissedFingerprints: ["f".repeat(257)],
    });
  });
});

describe("WriteUiStatePayloadSchema", () => {
  it("treats firstMonthInspection as optional", () => {
    expectSuccess(WriteUiStatePayloadSchema, { sessionId: "s", dismissedFingerprints: [] });
  });

  it("treats the inspector layout as optional", () => {
    expectSuccess(WriteUiStatePayloadSchema, {
      sessionId: "s",
      dismissedFingerprints: [],
      inspector: { widthPx: 500, collapsed: true },
    });
  });

  it("rejects a missing dismissedFingerprints", () => {
    expectFailure(WriteUiStatePayloadSchema, { sessionId: "s" });
  });
});

const VALID_MONTHLY_REPORT = {
  reportId: "save-1",
  campaignId: "camp_1",
  turn: 1,
  period: { from: { year: 1880, month: 1 }, to: { year: 1880, month: 2 } },
  generatedAt: "1880-02-01T00:00:00.000Z",
  treasury: {
    openingTreasury: 1000,
    closingTreasury: 944,
    maintenanceCost: 16,
    constructionSpending: 60,
    researchExpense: 5,
    governmentAllocation: 25,
    netChange: -56,
    ledgerRows: [
      {
        id: "l1",
        description: "revenue",
        phase: "monthly_revenue",
        amount: 25,
        runningBalance: 1025,
      },
    ],
  },
  construction: {
    projects: [{ projectId: "p1", previousWork: 1, newWork: 2 }],
    completedShips: [{ shipId: "s1", name: "HMS Example" }],
    newlyActiveProjectIds: ["p2"],
  },
  research: {
    progress: [{ techId: "t1", previousPoints: 1, newPoints: 2 }],
    discoveries: [{ techId: "t2", researchFieldId: "GUNNERY" }],
  },
  fleet: { additions: [{ shipId: "s1", name: "HMS Example" }], totalActiveShips: 8 },
  priorities: [
    {
      id: "monthly_deficit",
      type: "monthly_deficit",
      severity: "warning",
      title: "Monthly deficit",
      summary: "s",
      reason: "r",
      destination: "overview",
      fingerprint: "monthly_deficit",
    },
  ],
  battleOutcomes: [
    {
      battleId: "b1",
      areaId: "a1",
      attackerId: "uk",
      defenderId: "france",
      winnerId: "uk",
      loserId: "france",
      warScoreDelta: 2,
      attackerLosses: ["s1"],
      defenderLosses: [],
      explanation: [],
    },
  ],
} as const;

describe("MonthlyReportsSchema", () => {
  it("accepts an empty history and a full report entry", () => {
    expectSuccess(MonthlyReportsSchema, { reports: [] });
    expectSuccess(MonthlyReportsSchema, { reports: [VALID_MONTHLY_REPORT] });
  });

  it("rejects a report missing a section", () => {
    const { construction: _drop, ...rest } = VALID_MONTHLY_REPORT;
    expectFailure(MonthlyReportsSchema, { reports: [rest] });
  });

  it("rejects an unknown priority type or severity (closed enums)", () => {
    expectFailure(MonthlyReportsSchema, {
      reports: [
        {
          ...VALID_MONTHLY_REPORT,
          priorities: [{ ...VALID_MONTHLY_REPORT.priorities[0], type: "not_a_type" }],
        },
      ],
    });
    expectFailure(MonthlyReportsSchema, {
      reports: [
        {
          ...VALID_MONTHLY_REPORT,
          priorities: [{ ...VALID_MONTHLY_REPORT.priorities[0], severity: "extreme" }],
        },
      ],
    });
  });

  it("keeps decoding a report stored before the economy model and accepts the additive fields (parity, #138)", () => {
    expectSuccess(MonthlyReportsSchema, { reports: [VALID_MONTHLY_REPORT] });
    expectSuccess(MonthlyReportsSchema, {
      reports: [
        {
          ...VALID_MONTHLY_REPORT,
          treasury: {
            ...VALID_MONTHLY_REPORT.treasury,
            obligationExpense: 38,
            reconciliation: {
              opening: 1000,
              revenue: 25,
              construction: 60,
              preservation: 0,
              maintenance: 16,
              obligation: 38,
              research: 5,
              other: 38,
              closing: 944,
            },
            ledgerRows: [
              {
                ...VALID_MONTHLY_REPORT.treasury.ledgerRows[0]!,
                requested: 20,
                shortfall: 4,
              },
            ],
          },
        },
      ],
    });
  });

  it("rejects a non-integer treasury figure and a non-array ledger", () => {
    expectFailure(MonthlyReportsSchema, {
      reports: [
        { ...VALID_MONTHLY_REPORT, treasury: { ...VALID_MONTHLY_REPORT.treasury, netChange: 1.5 } },
      ],
    });
    expectFailure(MonthlyReportsSchema, {
      reports: [
        { ...VALID_MONTHLY_REPORT, treasury: { ...VALID_MONTHLY_REPORT.treasury, ledgerRows: 3 } },
      ],
    });
  });

  it("rejects a negative turn and a non-string generatedAt", () => {
    expectFailure(MonthlyReportsSchema, { reports: [{ ...VALID_MONTHLY_REPORT, turn: -1 }] });
    expectFailure(MonthlyReportsSchema, { reports: [{ ...VALID_MONTHLY_REPORT, generatedAt: 0 }] });
  });
});

describe("Tactical Sandbox payloads", () => {
  it("treats warId/areaId/strengthScale as optional with bounds", () => {
    expectSuccess(GenerateBattlePayloadSchema, { sessionId: "s" });
    expectSuccess(GenerateBattlePayloadSchema, {
      sessionId: "s",
      warId: "w",
      areaId: "a",
      strengthScale: 1000,
    });
    expectFailure(GenerateBattlePayloadSchema, { sessionId: "s", strengthScale: 0 });
    expectFailure(GenerateBattlePayloadSchema, { sessionId: "s", strengthScale: 1001 });
  });

  it("requires a positive integer turnCount and an array of scripted orders", () => {
    expectSuccess(ResolveTacticalBattlePayloadSchema, {
      sessionId: "s",
      battleId: "b",
      turnCount: 1,
      scriptedOrders: [],
    });
    expectFailure(ResolveTacticalBattlePayloadSchema, {
      sessionId: "s",
      battleId: "b",
      turnCount: 0,
      scriptedOrders: [],
    });
    expectFailure(ResolveTacticalBattlePayloadSchema, {
      sessionId: "s",
      battleId: "b",
      turnCount: 1,
      scriptedOrders: "nope",
    });
  });

  it("accepts a battle id payload", () => {
    expectSuccess(BattleIdPayloadSchema, { sessionId: "s", battleId: "b" });
    expectFailure(BattleIdPayloadSchema, { sessionId: "s" });
  });
});

describe("WriteDrawingBoardDraftPayloadSchema (nullable draft)", () => {
  it("accepts a null draft (removal) and a populated draft", () => {
    expectSuccess(WriteDrawingBoardDraftPayloadSchema, { sessionId: "s", draft: null });
    expectSuccess(WriteDrawingBoardDraftPayloadSchema, {
      sessionId: "s",
      draft: { presetId: "p", log: "[]" },
    });
  });

  it("rejects a malformed draft", () => {
    expectFailure(WriteDrawingBoardDraftPayloadSchema, {
      sessionId: "s",
      draft: { presetId: "p" },
    });
    expectFailure(WriteDrawingBoardDraftPayloadSchema, { sessionId: "s", draft: 3 });
  });
});

describe("SessionMetadataSchema (persistence sidecar)", () => {
  it("accepts a valid sidecar and strips unknown keys", () => {
    const decoded = expectSuccess(SessionMetadataSchema, {
      schemaVersion: "session_meta_v1",
      scenarioId: "scen_1880",
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      extra: true,
    });
    expect("extra" in decoded).toBe(false);
  });

  it("rejects a wrong schemaVersion or scenarioId", () => {
    expectFailure(SessionMetadataSchema, {
      schemaVersion: "session_meta_v2",
      scenarioId: "scen_1880",
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
    });
    expectFailure(SessionMetadataSchema, {
      schemaVersion: "session_meta_v1",
      scenarioId: "scen_9999",
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
    });
  });
});

describe("parseMonthInput (month input sidecar)", () => {
  const valid = {
    schema: "month_input_v1",
    commands: [],
    commandOutcomes: [],
    shipBuildingContentHash: "hash",
  };

  it("parses a valid record and treats armamentContentHash as optional", () => {
    expect(parseMonthInput(valid)).not.toBeNull();
    expect(parseMonthInput({ ...valid, armamentContentHash: "arm" })).not.toBeNull();
  });

  it("returns null for a wrong schema tag or a missing hash", () => {
    expect(parseMonthInput({ ...valid, schema: "month_input_v2" })).toBeNull();
    expect(parseMonthInput({ ...valid, shipBuildingContentHash: "" })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseMonthInput(null)).toBeNull();
    expect(parseMonthInput(42)).toBeNull();
  });
});

describe("LoadSaveResultSchema (IPC response envelope)", () => {
  it("accepts success and failure shapes", () => {
    expectSuccess(LoadSaveResultSchema, { success: true, diagnostics: [], rawHash: "h" });
    expectSuccess(LoadSaveResultSchema, {
      success: false,
      diagnostics: [{ code: "PERSISTENCE_MISSING_SAVE", severity: "error", message: "missing" }],
    });
  });

  it("rejects a result missing diagnostics", () => {
    expectFailure(LoadSaveResultSchema, { success: true });
  });
});

describe("PlaceForeignConstructionCommandPayloadSchema (strict, INC-17)", () => {
  const strictDecode = (input: unknown) =>
    Schema.decodeUnknownResult(PlaceForeignConstructionCommandPayloadSchema, {
      onExcessProperty: "error",
    })(input);

  it("accepts the player-choice fields (with and without a delivery month)", () => {
    expect(
      Result.isSuccess(
        strictDecode({
          ...VALID_ENVELOPE,
          designVersionId: "dv-1",
          builderNationId: "france",
          quantity: 1,
        }),
      ),
    ).toBe(true);
    expect(
      Result.isSuccess(
        strictDecode({
          ...VALID_ENVELOPE,
          designVersionId: "dv-1",
          builderNationId: "france",
          quantity: 2,
          plannedDeliveryMonth: "1880-06",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a payload carrying a fabricated terms or capability field", () => {
    expect(
      Result.isFailure(
        strictDecode({
          ...VALID_ENVELOPE,
          designVersionId: "dv-1",
          builderNationId: "france",
          quantity: 1,
          terms: { totalPriceUnits: 1 },
        }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        strictDecode({
          ...VALID_ENVELOPE,
          designVersionId: "dv-1",
          builderNationId: "france",
          quantity: 1,
          capability: { physicallyCapable: true },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a fabricated terms payload through the bridge with INVALID_PAYLOAD", async () => {
    const result = await dispatchCampaignCommand("placeForeignConstructionCommand", {
      ...VALID_ENVELOPE,
      designVersionId: "dv-1",
      builderNationId: "france",
      quantity: 1,
      terms: { totalPriceUnits: 1 },
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("rejects a non-positive quantity, a non-integer, and a malformed delivery month", () => {
    for (const bad of [
      { quantity: 0 },
      { quantity: -1 },
      { quantity: 1.5 },
      { quantity: 1, plannedDeliveryMonth: "1880/06" },
      { quantity: 1, plannedDeliveryMonth: "1880-6" },
    ]) {
      expect(
        Result.isFailure(
          strictDecode({
            ...VALID_ENVELOPE,
            designVersionId: "dv-1",
            builderNationId: "france",
            ...bad,
          }),
        ),
      ).toBe(true);
    }
  });
});

describe("campaignBridge error mapping", () => {
  it("maps a schema failure to a non-empty INVALID_PAYLOAD diagnostics list", async () => {
    const result = await dispatchCampaignCommand("commitMonth", { sessionId: "" });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics.every((message) => typeof message === "string")).toBe(true);
  });
});
