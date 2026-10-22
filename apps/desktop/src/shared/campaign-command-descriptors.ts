import type {
  CampaignConfiguration,
  CommitMonthResponse,
  InspectPrioritiesResult,
  ReplayBattleBoundaryResponse,
} from "@bluewave/campaign-engine";
import type { SaveMetadata } from "@bluewave/persistence";
import { Schema } from "effect";
import type { CommandEnvelope } from "./bridge-contract.js";
import type {
  AbandonPendingTurnResult,
  AdvancePlayerBattleResult,
  CompileCampaignResult,
  CopyCampaignResult,
  FinishPlayerBattleResult,
  GenerateBattleResult,
  InspectBattleHistoryResult,
  InspectCampaignResult,
  InspectMapResult,
  InspectOpeningBriefingResult,
  PlayerBattleDivisionOrderDto,
  ReadMonthlyReportsResult,
  ReadPendingTurnResult,
  ReadTurnSummariesResult,
  ReadUiStateResult,
  ResolveBattleResult,
  ResolveTacticalBattleResult,
  ResolveTurnResult,
  SaveCampaignResult,
  SeedCampaignBattleDrillResult,
  StartPlayerBattleResult,
  UiStateFirstMonthInspection,
  UiStateInspectorLayout,
  UiStateTurnMessages,
  WriteUiStateResult,
} from "./campaign-command-contract.js";
import type {
  AuthorizeDockExpansionCommandPayload,
  CancelConstructionCommandPayload,
  CancelConstructionProjectCommandPayload,
  HaltConstructionCommandPayload,
  OrderConstructionBatchCommandPayload,
  PlaceForeignConstructionCommandPayload,
  PreviewConstructionBatchCommandPayload,
  PreviewForeignConstructionCommandPayload,
  ReplaceConstructionCommandPayload,
  ResumeConstructionCommandPayload,
  SetAccelerationCommandPayload,
  SubmitConstructionCommandPayload,
} from "./construction-contract.js";
import type {
  DrawingBoardContentDto,
  PresentationContentDto,
  UiCatalogueDto,
} from "./content-contract.js";
import {
  AdvancePlayerBattlePayloadSchema,
  AnswerDecisionPayloadSchema,
  AuthorizeDockExpansionCommandPayloadSchema,
  BattleIdPayloadSchema,
  CancelConstructionOrderPayloadSchema,
  CancelConstructionProjectPayloadSchema,
  CancelMovementCommandPayloadSchema,
  CampaignConfigurationPayloadSchema,
  CommandEnvelopePayloadSchema,
  ConstructionOrderPayloadSchema,
  FinishPlayerBattlePayloadSchema,
  GenerateBattlePayloadSchema,
  HaltConstructionCommandPayloadSchema,
  LoadProjectDraftPayloadSchema,
  LoadShipDraftPayloadSchema,
  OrderConstructionBatchCommandPayloadSchema,
  PlaceForeignConstructionCommandPayloadSchema,
  PreviewConstructionBatchCommandPayloadSchema,
  PreviewForeignConstructionCommandPayloadSchema,
  RecentPackagePayloadSchema,
  RebuildCheckPayloadSchema,
  ReplaceConstructionOrderPayloadSchema,
  ReplaceMovementCommandPayloadSchema,
  ResolveTacticalBattlePayloadSchema,
  ResumeConstructionCommandPayloadSchema,
  ReviseProjectCommandPayloadSchema,
  SeedCampaignBattleDrillPayloadSchema,
  SessionIdPayloadSchema,
  SetAccelerationCommandPayloadSchema,
  SetResearchPriorityCommandPayloadSchema,
  StartPlayerBattlePayloadSchema,
  StartRebuildCommandPayloadSchema,
  SubmitBattleResultPayloadSchema,
  SubmitBudgetAllocationPayloadSchema,
  SubmitDesignCommandPayloadSchema,
  SubmitDiplomacyCommandPayloadSchema,
  SubmitDivisionCommandPayloadSchema,
  SubmitMovementCommandPayloadSchema,
  SubmitOfferResponsePayloadSchema,
  SubmitStationAssignmentPayloadSchema,
  WriteDrawingBoardDraftPayloadSchema,
  WriteUiStatePayloadSchema,
} from "./campaignCommandSchemas.js";
import type {
  BudgetCommandOutcome,
  BudgetScreenProjection,
  SubmitBudgetAllocationPayload,
} from "./budget-contract.js";
import type {
  ConstructionBatchPreviewOutcome,
  ConstructionCommandOutcome,
  ConstructionCommandQueuedOutcome,
  ConstructionScreenProjection,
  ForeignConstructionPreviewOutcome,
} from "./construction-contract.js";
import type {
  LoadCampaignResponse,
  RecentCampaignEntry,
  RecoverCampaignResponse,
  ReplayCampaignResponse,
  VerifyCampaignResponse,
} from "./continuity-contract.js";
import type {
  DesignCommandOutcome,
  LoadProjectDraftPayload,
  LoadShipDraftPayload,
  ProjectDraftView,
  ReadDrawingBoardDraftResult,
  RebuildCheckPayload,
  RebuildCheckView,
  RebuildableShipView,
  RebuildCommandOutcome,
  ReviseCommandOutcome,
  ReviseProjectCommandPayload,
  ShipDraftView,
  StartRebuildCommandPayload,
  SubmitDesignCommandPayload,
  WriteDrawingBoardDraftPayload,
} from "./design-contract.js";
import type {
  DiplomacyCommandOutcome,
  DiplomacyScreenProjection,
  SubmitDiplomacyCommandPayload,
} from "./diplomacy-contract.js";
import type {
  DivisionCommandOutcome,
  DivisionScreenProjection,
  SubmitDivisionCommandPayload,
} from "./division-contract.js";
import type {
  CancelMovementCommandPayload,
  FleetScreenProjection,
  MovementCommandOutcome,
  ReplaceMovementCommandPayload,
  StationAssignmentOutcome,
  SubmitMovementCommandPayload,
  SubmitStationAssignmentPayload,
} from "./fleet-contract.js";
import type { NewGameOptions } from "./new-game-contract.js";
import type {
  ResearchPriorityOutcome,
  ResearchScreenProjection,
  SetResearchPriorityCommandPayload,
} from "./research-contract.js";

/*
 * The command-descriptor table is the single runtime source of truth for the
 * campaign command surface. Each row pairs a command's payload schema (yielding
 * both the static request type and the runtime IPC decoder) with its result
 * type; the name set, the main-process program registry and the completeness
 * check are all derived from its keys. Adding a command is one row here plus its
 * handler in `main/campaignBridge.ts`.
 *
 * {@link CampaignCommandMap} is the renderer-facing type map. The `satisfies`
 * below pins every row to that map, so a row whose payload schema decodes to the
 * wrong shape, or a map entry with no row, fails to compile — the two cannot
 * drift. The map stays an explicit interface (rather than a mapped type over the
 * table) because TypeScript cannot resolve a conditional mapped type indexed by
 * a generic parameter, which the bridge client's generic `execute` needs.
 *
 * The handler program lives in main because it runs in the Electron main
 * process; this module imports no main-process code so the renderer can derive
 * its types from it without bundling the IPC implementation.
 */

/** Marks a command that takes no payload. */
export const NO_PAYLOAD = Symbol("campaign-command-no-payload");

export interface ResultType<R> {
  readonly _result?: R;
}

export const resultType = <R>(): ResultType<R> => ({});

export interface CommandShape<PS, R> {
  readonly payload: PS;
  readonly result: ResultType<R>;
}

export function command<R>(
  payload: typeof NO_PAYLOAD,
  result: ResultType<R>,
): CommandShape<typeof NO_PAYLOAD, R>;
export function command<P, R>(
  payload: Schema.Schema<P>,
  result: ResultType<R>,
): CommandShape<Schema.Schema<P>, R>;
export function command(
  payload: typeof NO_PAYLOAD | Schema.Schema<unknown>,
  result: ResultType<unknown>,
): CommandShape<unknown, unknown> {
  return { payload, result };
}

/**
 * The command-descriptor registry: one entry per command, mapping each name to
 * its payload and result types. Kept in sync with
 * {@link campaignCommandShapes} by a `satisfies` check.
 */
export interface CampaignCommandMap {
  listNewGameOptions: { readonly payload: undefined; readonly result: NewGameOptions };
  compileCampaign: {
    readonly payload: CampaignConfiguration;
    readonly result: CompileCampaignResult;
  };
  inspectCampaign: { readonly payload: string; readonly result: InspectCampaignResult };
  inspectOpeningBriefing: {
    readonly payload: string;
    readonly result: InspectOpeningBriefingResult;
  };
  inspectMap: { readonly payload: string; readonly result: InspectMapResult };
  inspectBattleHistory: { readonly payload: string; readonly result: InspectBattleHistoryResult };
  inspectPriorities: { readonly payload: string; readonly result: InspectPrioritiesResult };
  inspectDrawingBoardContent: {
    readonly payload: undefined;
    readonly result: DrawingBoardContentDto;
  };
  inspectPresentationContent: {
    readonly payload: undefined;
    readonly result: PresentationContentDto;
  };
  inspectUiCatalogue: { readonly payload: undefined; readonly result: UiCatalogueDto };
  closeCampaign: { readonly payload: string; readonly result: unknown };
  saveCampaign: { readonly payload: string; readonly result: SaveCampaignResult };
  copyCampaign: { readonly payload: string; readonly result: CopyCampaignResult };
  commitMonth: { readonly payload: CommandEnvelope; readonly result: CommitMonthResponse };
  generateBattle: {
    readonly payload: { readonly sessionId: string; readonly warId?: string };
    readonly result: GenerateBattleResult;
  };
  resolveBattle: {
    readonly payload: { readonly sessionId: string; readonly battleId: string };
    readonly result: ResolveBattleResult;
  };
  resolveTacticalBattle: {
    readonly payload: {
      readonly sessionId: string;
      readonly battleId: string;
      readonly turnCount: number;
      readonly scriptedOrders: readonly unknown[];
    };
    readonly result: ResolveTacticalBattleResult;
  };
  replayBattleBoundary: {
    readonly payload: { readonly sessionId: string; readonly battleId: string };
    readonly result: ReplayBattleBoundaryResponse;
  };
  seedCampaignBattleDrill: {
    readonly payload: { readonly sessionId: string; readonly warId?: string };
    readonly result: SeedCampaignBattleDrillResult;
  };
  loadCampaign: { readonly payload: undefined; readonly result: LoadCampaignResponse };
  loadRecentCampaign: {
    readonly payload: { readonly packagePath: string };
    readonly result: LoadCampaignResponse;
  };
  listRecentCampaigns: {
    readonly payload: undefined;
    readonly result: readonly RecentCampaignEntry[];
  };
  removeRecentCampaign: {
    readonly payload: { readonly packagePath: string };
    readonly result: readonly RecentCampaignEntry[];
  };
  listCampaigns: { readonly payload: undefined; readonly result: readonly SaveMetadata[] };
  verifyCampaign: { readonly payload: undefined; readonly result: VerifyCampaignResponse };
  replayCampaign: { readonly payload: undefined; readonly result: ReplayCampaignResponse };
  recoverCampaign: { readonly payload: undefined; readonly result: RecoverCampaignResponse };
  inspectConstructionScreen: {
    readonly payload: string;
    readonly result: ConstructionScreenProjection;
  };
  submitConstructionCommand: {
    readonly payload: SubmitConstructionCommandPayload;
    readonly result: ConstructionCommandOutcome;
  };
  replaceConstructionCommand: {
    readonly payload: ReplaceConstructionCommandPayload;
    readonly result: ConstructionCommandOutcome;
  };
  cancelConstructionCommand: {
    readonly payload: CancelConstructionCommandPayload;
    readonly result: ConstructionCommandOutcome;
  };
  haltConstructionCommand: {
    readonly payload: HaltConstructionCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  resumeConstructionCommand: {
    readonly payload: ResumeConstructionCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  setAccelerationCommand: {
    readonly payload: SetAccelerationCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  cancelConstructionProjectCommand: {
    readonly payload: CancelConstructionProjectCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  orderConstructionBatchCommand: {
    readonly payload: OrderConstructionBatchCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  previewConstructionBatchCommand: {
    readonly payload: PreviewConstructionBatchCommandPayload;
    readonly result: ConstructionBatchPreviewOutcome;
  };
  authorizeDockExpansionCommand: {
    readonly payload: AuthorizeDockExpansionCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  placeForeignConstructionCommand: {
    readonly payload: PlaceForeignConstructionCommandPayload;
    readonly result: ConstructionCommandQueuedOutcome;
  };
  previewForeignConstructionCommand: {
    readonly payload: PreviewForeignConstructionCommandPayload;
    readonly result: ForeignConstructionPreviewOutcome;
  };
  inspectFleetScreen: { readonly payload: string; readonly result: FleetScreenProjection };
  submitMovementCommand: {
    readonly payload: SubmitMovementCommandPayload;
    readonly result: MovementCommandOutcome;
  };
  submitStationAssignment: {
    readonly payload: SubmitStationAssignmentPayload;
    readonly result: StationAssignmentOutcome;
  };
  replaceMovementCommand: {
    readonly payload: ReplaceMovementCommandPayload;
    readonly result: MovementCommandOutcome;
  };
  cancelMovementCommand: {
    readonly payload: CancelMovementCommandPayload;
    readonly result: MovementCommandOutcome;
  };
  submitDesignCommand: {
    readonly payload: SubmitDesignCommandPayload;
    readonly result: DesignCommandOutcome;
  };
  reviseProjectCommand: {
    readonly payload: ReviseProjectCommandPayload;
    readonly result: ReviseCommandOutcome;
  };
  loadProjectDraft: {
    readonly payload: LoadProjectDraftPayload;
    readonly result: ProjectDraftView;
  };
  readDrawingBoardDraft: { readonly payload: string; readonly result: ReadDrawingBoardDraftResult };
  writeDrawingBoardDraft: {
    readonly payload: WriteDrawingBoardDraftPayload;
    readonly result: { readonly saved: boolean };
  };
  listRebuildableShips: {
    readonly payload: string;
    readonly result: readonly RebuildableShipView[];
  };
  loadShipDraft: { readonly payload: LoadShipDraftPayload; readonly result: ShipDraftView };
  checkRebuild: { readonly payload: RebuildCheckPayload; readonly result: RebuildCheckView };
  startRebuildCommand: {
    readonly payload: StartRebuildCommandPayload;
    readonly result: RebuildCommandOutcome;
  };
  inspectResearchScreen: { readonly payload: string; readonly result: ResearchScreenProjection };
  setResearchPriorityCommand: {
    readonly payload: SetResearchPriorityCommandPayload;
    readonly result: ResearchPriorityOutcome;
  };
  inspectDiplomacyScreen: { readonly payload: string; readonly result: DiplomacyScreenProjection };
  submitDiplomacyCommand: {
    readonly payload: SubmitDiplomacyCommandPayload;
    readonly result: DiplomacyCommandOutcome;
  };
  inspectDivisionScreen: { readonly payload: string; readonly result: DivisionScreenProjection };
  submitDivisionCommand: {
    readonly payload: SubmitDivisionCommandPayload;
    readonly result: DivisionCommandOutcome;
  };
  inspectBudgetScreen: { readonly payload: string; readonly result: BudgetScreenProjection };
  submitBudgetAllocation: {
    readonly payload: SubmitBudgetAllocationPayload;
    readonly result: BudgetCommandOutcome;
  };
  readUiState: { readonly payload: string; readonly result: ReadUiStateResult };
  writeUiState: { readonly payload: WriteUiStatePayload; readonly result: WriteUiStateResult };
  readMonthlyReports: { readonly payload: string; readonly result: ReadMonthlyReportsResult };
  readTurnSummaries: { readonly payload: string; readonly result: ReadTurnSummariesResult };
  resolveTurn: { readonly payload: CommandEnvelope; readonly result: ResolveTurnResult };
  answerDecision: { readonly payload: AnswerDecisionPayload; readonly result: ResolveTurnResult };
  submitBattleResult: {
    readonly payload: SubmitBattleResultPayload;
    readonly result: ResolveTurnResult;
  };
  startPlayerBattle: {
    readonly payload: { readonly sessionId: string; readonly battleId: string };
    readonly result: StartPlayerBattleResult;
  };
  advancePlayerBattle: {
    readonly payload: AdvancePlayerBattlePayload;
    readonly result: AdvancePlayerBattleResult;
  };
  finishPlayerBattle: {
    readonly payload: { readonly sessionId: string; readonly battleId: string };
    readonly result: FinishPlayerBattleResult;
  };
  submitOfferResponse: {
    readonly payload: SubmitOfferResponsePayload;
    readonly result: ResolveTurnResult;
  };
  abandonPendingTurn: { readonly payload: string; readonly result: AbandonPendingTurnResult };
  readPendingTurn: { readonly payload: string; readonly result: ReadPendingTurnResult };
}

/**
 * Request payloads for the turn-interruption surface. The schemas in
 * `campaignCommandSchemas.ts` decode to these shapes and the `satisfies` below
 * pins them together.
 */
export interface AnswerDecisionPayload {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
  readonly interruptionId: string;
  readonly decisionId: string;
  readonly optionId: string;
}

export interface SubmitBattleResultPayload {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
  readonly interruptionId: string;
  readonly battleId: string;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly damageReport: Readonly<Record<string, number>>;
}

/** The player's answer to a battle offer (T-1 03, T-1 04): accept, delegate, or decline. */
export interface SubmitOfferResponsePayload {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
  readonly interruptionId: string;
  readonly battleId: string;
  readonly response: "accept" | "delegate" | "decline";
}

export interface AdvancePlayerBattlePayload {
  readonly sessionId: string;
  readonly battleId: string;
  readonly mode: "minute" | "to_end";
  readonly divisions: readonly PlayerBattleDivisionOrderDto[];
}

export interface WriteUiStatePayload {
  readonly sessionId: string;
  readonly dismissedFingerprints: readonly string[];
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  readonly inspector?: UiStateInspectorLayout;
  readonly turnMessages?: UiStateTurnMessages;
}

type PayloadSchemaFor<N extends keyof CampaignCommandMap> =
  CampaignCommandMap[N]["payload"] extends undefined
    ? typeof NO_PAYLOAD
    : Schema.Schema<CampaignCommandMap[N]["payload"]>;

export const campaignCommandShapes = {
  listNewGameOptions: command(NO_PAYLOAD, resultType<NewGameOptions>()),
  compileCampaign: command(CampaignConfigurationPayloadSchema, resultType<CompileCampaignResult>()),
  inspectCampaign: command(SessionIdPayloadSchema, resultType<InspectCampaignResult>()),
  inspectOpeningBriefing: command(
    SessionIdPayloadSchema,
    resultType<InspectOpeningBriefingResult>(),
  ),
  inspectMap: command(SessionIdPayloadSchema, resultType<InspectMapResult>()),
  inspectBattleHistory: command(SessionIdPayloadSchema, resultType<InspectBattleHistoryResult>()),
  inspectPriorities: command(SessionIdPayloadSchema, resultType<InspectPrioritiesResult>()),
  inspectDrawingBoardContent: command(NO_PAYLOAD, resultType<DrawingBoardContentDto>()),
  inspectPresentationContent: command(NO_PAYLOAD, resultType<PresentationContentDto>()),
  inspectUiCatalogue: command(NO_PAYLOAD, resultType<UiCatalogueDto>()),
  closeCampaign: command(SessionIdPayloadSchema, resultType<unknown>()),
  saveCampaign: command(SessionIdPayloadSchema, resultType<SaveCampaignResult>()),
  copyCampaign: command(SessionIdPayloadSchema, resultType<CopyCampaignResult>()),
  commitMonth: command(CommandEnvelopePayloadSchema, resultType<CommitMonthResponse>()),
  generateBattle: command(GenerateBattlePayloadSchema, resultType<GenerateBattleResult>()),
  resolveBattle: command(BattleIdPayloadSchema, resultType<ResolveBattleResult>()),
  resolveTacticalBattle: command(
    ResolveTacticalBattlePayloadSchema,
    resultType<ResolveTacticalBattleResult>(),
  ),
  replayBattleBoundary: command(BattleIdPayloadSchema, resultType<ReplayBattleBoundaryResponse>()),
  seedCampaignBattleDrill: command(
    SeedCampaignBattleDrillPayloadSchema,
    resultType<SeedCampaignBattleDrillResult>(),
  ),
  loadCampaign: command(NO_PAYLOAD, resultType<LoadCampaignResponse>()),
  loadRecentCampaign: command(RecentPackagePayloadSchema, resultType<LoadCampaignResponse>()),
  listRecentCampaigns: command(NO_PAYLOAD, resultType<readonly RecentCampaignEntry[]>()),
  removeRecentCampaign: command(
    RecentPackagePayloadSchema,
    resultType<readonly RecentCampaignEntry[]>(),
  ),
  listCampaigns: command(NO_PAYLOAD, resultType<readonly SaveMetadata[]>()),
  verifyCampaign: command(NO_PAYLOAD, resultType<VerifyCampaignResponse>()),
  replayCampaign: command(NO_PAYLOAD, resultType<ReplayCampaignResponse>()),
  recoverCampaign: command(NO_PAYLOAD, resultType<RecoverCampaignResponse>()),
  inspectConstructionScreen: command(
    SessionIdPayloadSchema,
    resultType<ConstructionScreenProjection>(),
  ),
  submitConstructionCommand: command(
    ConstructionOrderPayloadSchema,
    resultType<ConstructionCommandOutcome>(),
  ),
  replaceConstructionCommand: command(
    ReplaceConstructionOrderPayloadSchema,
    resultType<ConstructionCommandOutcome>(),
  ),
  cancelConstructionCommand: command(
    CancelConstructionOrderPayloadSchema,
    resultType<ConstructionCommandOutcome>(),
  ),
  haltConstructionCommand: command(
    HaltConstructionCommandPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  resumeConstructionCommand: command(
    ResumeConstructionCommandPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  setAccelerationCommand: command(
    SetAccelerationCommandPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  cancelConstructionProjectCommand: command(
    CancelConstructionProjectPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  orderConstructionBatchCommand: command(
    OrderConstructionBatchCommandPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  previewConstructionBatchCommand: command(
    PreviewConstructionBatchCommandPayloadSchema,
    resultType<ConstructionBatchPreviewOutcome>(),
  ),
  authorizeDockExpansionCommand: command(
    AuthorizeDockExpansionCommandPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  placeForeignConstructionCommand: command(
    PlaceForeignConstructionCommandPayloadSchema,
    resultType<ConstructionCommandQueuedOutcome>(),
  ),
  previewForeignConstructionCommand: command(
    PreviewForeignConstructionCommandPayloadSchema,
    resultType<ForeignConstructionPreviewOutcome>(),
  ),
  inspectFleetScreen: command(SessionIdPayloadSchema, resultType<FleetScreenProjection>()),
  submitMovementCommand: command(
    SubmitMovementCommandPayloadSchema,
    resultType<MovementCommandOutcome>(),
  ),
  submitStationAssignment: command(
    SubmitStationAssignmentPayloadSchema,
    resultType<StationAssignmentOutcome>(),
  ),
  replaceMovementCommand: command(
    ReplaceMovementCommandPayloadSchema,
    resultType<MovementCommandOutcome>(),
  ),
  cancelMovementCommand: command(
    CancelMovementCommandPayloadSchema,
    resultType<MovementCommandOutcome>(),
  ),
  submitDesignCommand: command(
    SubmitDesignCommandPayloadSchema,
    resultType<DesignCommandOutcome>(),
  ),
  reviseProjectCommand: command(
    ReviseProjectCommandPayloadSchema,
    resultType<ReviseCommandOutcome>(),
  ),
  loadProjectDraft: command(LoadProjectDraftPayloadSchema, resultType<ProjectDraftView>()),
  readDrawingBoardDraft: command(SessionIdPayloadSchema, resultType<ReadDrawingBoardDraftResult>()),
  writeDrawingBoardDraft: command(
    WriteDrawingBoardDraftPayloadSchema,
    resultType<{ readonly saved: boolean }>(),
  ),
  listRebuildableShips: command(
    SessionIdPayloadSchema,
    resultType<readonly RebuildableShipView[]>(),
  ),
  loadShipDraft: command(LoadShipDraftPayloadSchema, resultType<ShipDraftView>()),
  checkRebuild: command(RebuildCheckPayloadSchema, resultType<RebuildCheckView>()),
  startRebuildCommand: command(
    StartRebuildCommandPayloadSchema,
    resultType<RebuildCommandOutcome>(),
  ),
  inspectResearchScreen: command(SessionIdPayloadSchema, resultType<ResearchScreenProjection>()),
  setResearchPriorityCommand: command(
    SetResearchPriorityCommandPayloadSchema,
    resultType<ResearchPriorityOutcome>(),
  ),
  inspectDiplomacyScreen: command(SessionIdPayloadSchema, resultType<DiplomacyScreenProjection>()),
  submitDiplomacyCommand: command(
    SubmitDiplomacyCommandPayloadSchema,
    resultType<DiplomacyCommandOutcome>(),
  ),
  inspectDivisionScreen: command(SessionIdPayloadSchema, resultType<DivisionScreenProjection>()),
  submitDivisionCommand: command(
    SubmitDivisionCommandPayloadSchema,
    resultType<DivisionCommandOutcome>(),
  ),
  inspectBudgetScreen: command(SessionIdPayloadSchema, resultType<BudgetScreenProjection>()),
  submitBudgetAllocation: command(
    SubmitBudgetAllocationPayloadSchema,
    resultType<BudgetCommandOutcome>(),
  ),
  readUiState: command(SessionIdPayloadSchema, resultType<ReadUiStateResult>()),
  writeUiState: command(WriteUiStatePayloadSchema, resultType<WriteUiStateResult>()),
  readMonthlyReports: command(SessionIdPayloadSchema, resultType<ReadMonthlyReportsResult>()),
  readTurnSummaries: command(SessionIdPayloadSchema, resultType<ReadTurnSummariesResult>()),
  resolveTurn: command(CommandEnvelopePayloadSchema, resultType<ResolveTurnResult>()),
  answerDecision: command(AnswerDecisionPayloadSchema, resultType<ResolveTurnResult>()),
  submitBattleResult: command(SubmitBattleResultPayloadSchema, resultType<ResolveTurnResult>()),
  startPlayerBattle: command(StartPlayerBattlePayloadSchema, resultType<StartPlayerBattleResult>()),
  advancePlayerBattle: command(
    AdvancePlayerBattlePayloadSchema,
    resultType<AdvancePlayerBattleResult>(),
  ),
  finishPlayerBattle: command(
    FinishPlayerBattlePayloadSchema,
    resultType<FinishPlayerBattleResult>(),
  ),
  submitOfferResponse: command(SubmitOfferResponsePayloadSchema, resultType<ResolveTurnResult>()),
  abandonPendingTurn: command(SessionIdPayloadSchema, resultType<AbandonPendingTurnResult>()),
  readPendingTurn: command(SessionIdPayloadSchema, resultType<ReadPendingTurnResult>()),
} satisfies {
  readonly [N in keyof CampaignCommandMap]: CommandShape<
    PayloadSchemaFor<N>,
    CampaignCommandMap[N]["result"]
  >;
};

export type CampaignCommandName = keyof CampaignCommandMap;

export const CAMPAIGN_COMMAND_NAMES = Object.keys(
  campaignCommandShapes,
) as readonly CampaignCommandName[];
