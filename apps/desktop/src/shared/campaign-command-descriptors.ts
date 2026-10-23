import type {
  CommitMonthResponse,
  InspectPrioritiesResult,
  ReplayBattleBoundaryResponse,
} from "@bluewave/campaign-engine";
import type { SaveMetadata } from "@bluewave/persistence";
import { Schema } from "effect";
import type {
  AbandonPendingTurnResult,
  ReadPendingTurnResult,
  ReadTurnSummariesResult,
  ResolveTurnResult,
} from "./turn-message-contract.js";
import type {
  AdvancePlayerBattleResult,
  FinishPlayerBattleResult,
  PlayerBattleDivisionOrderDto,
  StartPlayerBattleResult,
} from "./player-battle-contract.js";
import type {
  CompileCampaignResult,
  CopyCampaignResult,
  GenerateBattleResult,
  InspectBattleHistoryResult,
  InspectCampaignResult,
  InspectMapResult,
  InspectOpeningBriefingResult,
  ResolveBattleResult,
  ResolveTacticalBattleResult,
  SaveCampaignResult,
  SeedCampaignBattleDrillResult,
} from "./campaign-contract.js";
import type { ReadMonthlyReportsResult } from "./reports-contract.js";
import type { ReadUiStateResult, UiStatePatch, WriteUiStateResult } from "./ui-state-contract.js";
import type {
  DrawingBoardContentDto,
  PresentationContentDto,
  UiCatalogueDto,
} from "./content-contract.js";
import {
  AdvancePlayerBattlePayloadSchema,
  FinishPlayerBattlePayloadSchema,
  StartPlayerBattlePayloadSchema,
} from "./player-battle-schemas.js";
import {
  AnswerDecisionPayloadSchema,
  AuthorizeDockExpansionCommandPayloadSchema,
  BattleIdPayloadSchema,
  CancelConstructionOrderPayloadSchema,
  CancelConstructionProjectPayloadSchema,
  CancelMovementCommandPayloadSchema,
  CampaignConfigurationPayloadSchema,
  CommandEnvelopePayloadSchema,
  ConstructionOrderPayloadSchema,
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
} from "./campaignCommandSchemas.js";
import { WriteUiStatePayloadSchema } from "./ui-state-schemas.js";
import type { BudgetCommandOutcome, BudgetScreenProjection } from "./budget-contract.js";
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
  ProjectDraftView,
  ReadDrawingBoardDraftResult,
  RebuildCheckView,
  RebuildableShipView,
  RebuildCommandOutcome,
  ReviseCommandOutcome,
  ShipDraftView,
} from "./design-contract.js";
import type { DiplomacyCommandOutcome, DiplomacyScreenProjection } from "./diplomacy-contract.js";
import type { DivisionCommandOutcome, DivisionScreenProjection } from "./division-contract.js";
import type {
  FleetScreenProjection,
  MovementCommandOutcome,
  StationAssignmentOutcome,
} from "./fleet-contract.js";
import type { NewGameOptions } from "./new-game-contract.js";
import type { ResearchPriorityOutcome, ResearchScreenProjection } from "./research-contract.js";

export const NO_PAYLOAD = Symbol("campaign-command-no-payload");

export interface ResultType<R> {
  readonly _result: R;
}

export const resultType = <R>(): ResultType<R> => ({}) as ResultType<R>;

export interface CommandShape<P, R> {
  readonly payload: Schema.ConstraintDecoder<P, never> | typeof NO_PAYLOAD;
  readonly payloadType: P;
  readonly result: ResultType<R>;
  readonly strict: boolean;
}

export interface CommandOptions {
  readonly strict?: boolean;
}

export function command<R>(
  payload: typeof NO_PAYLOAD,
  result: ResultType<R>,
): CommandShape<undefined, R>;
export function command<P, R>(
  payload: Schema.ConstraintDecoder<P, never>,
  result: ResultType<R>,
  options?: CommandOptions,
): CommandShape<P, R>;
export function command(
  payload: typeof NO_PAYLOAD | Schema.ConstraintDecoder<unknown, never>,
  result: ResultType<unknown>,
  options?: CommandOptions,
): CommandShape<unknown, unknown> {
  return {
    payload,
    payloadType: undefined,
    result,
    strict: options?.strict === true,
  };
}

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

export interface WriteUiStatePayload extends UiStatePatch {
  readonly sessionId: string;
}

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
  loadRecentCampaign: command(RecentPackagePayloadSchema, resultType<LoadCampaignResponse>(), {
    strict: true,
  }),
  listRecentCampaigns: command(NO_PAYLOAD, resultType<readonly RecentCampaignEntry[]>()),
  removeRecentCampaign: command(
    RecentPackagePayloadSchema,
    resultType<readonly RecentCampaignEntry[]>(),
    { strict: true },
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
    { strict: true },
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
  writeUiState: command(WriteUiStatePayloadSchema, resultType<WriteUiStateResult>(), {
    strict: true,
  }),
  readMonthlyReports: command(SessionIdPayloadSchema, resultType<ReadMonthlyReportsResult>()),
  readTurnSummaries: command(SessionIdPayloadSchema, resultType<ReadTurnSummariesResult>()),
  resolveTurn: command(CommandEnvelopePayloadSchema, resultType<ResolveTurnResult>()),
  answerDecision: command(AnswerDecisionPayloadSchema, resultType<ResolveTurnResult>()),
  submitBattleResult: command(SubmitBattleResultPayloadSchema, resultType<ResolveTurnResult>()),
  startPlayerBattle: command(
    StartPlayerBattlePayloadSchema,
    resultType<StartPlayerBattleResult>(),
    { strict: true },
  ),
  advancePlayerBattle: command(
    AdvancePlayerBattlePayloadSchema,
    resultType<AdvancePlayerBattleResult>(),
    { strict: true },
  ),
  finishPlayerBattle: command(
    FinishPlayerBattlePayloadSchema,
    resultType<FinishPlayerBattleResult>(),
    { strict: true },
  ),
  submitOfferResponse: command(SubmitOfferResponsePayloadSchema, resultType<ResolveTurnResult>(), {
    strict: true,
  }),
  abandonPendingTurn: command(SessionIdPayloadSchema, resultType<AbandonPendingTurnResult>()),
  readPendingTurn: command(SessionIdPayloadSchema, resultType<ReadPendingTurnResult>()),
} as const;

export type CampaignCommandMap = {
  readonly [N in keyof typeof campaignCommandShapes]: {
    readonly payload: (typeof campaignCommandShapes)[N]["payloadType"];
    readonly result: (typeof campaignCommandShapes)[N]["result"]["_result"];
  };
};

export type CampaignCommandName = keyof CampaignCommandMap;

export const CAMPAIGN_COMMAND_NAMES = Object.keys(
  campaignCommandShapes,
) as readonly CampaignCommandName[];
