import type {
  BattleManifest,
  BattleOutcome,
  BattleResolution,
  LedgerReconciliation,
  OpeningBriefingProjection,
  PlayerProjection,
  RandomDecisionRecord,
  StrategicPriority,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";
import type { BattleHistoryView, StrategicMapView } from "@bluewave/campaign-engine";
import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { BridgeResult } from "./bridge-contract.js";
import type { CampaignCommandMap, CampaignCommandName } from "./campaign-command-descriptors.js";

export type { CampaignCommandMap, CampaignCommandName } from "./campaign-command-descriptors.js";

export interface GenerateBattleResult {
  readonly manifest: BattleManifest;
  readonly randomDecisions: readonly RandomDecisionRecord[];
}

export interface ResolveBattleResult {
  readonly resolution: BattleResolution;
}

export interface ResolveTacticalBattleResult {
  readonly outcome: TacticalBattleOutcome;
  readonly randomDecisions?: readonly RandomDecisionRecord[];
}

export interface SeedCampaignBattleDrillResult {
  readonly warId: string;
  readonly areaId: string;
  readonly strengthScale: number;
  readonly moved: boolean;
  readonly excludedShipIds: readonly string[];
}

export interface CompileCampaignResult {
  readonly sessionId: string;
}

export interface InspectCampaignResult {
  readonly projection: PlayerProjection;
}

export interface InspectOpeningBriefingResult {
  readonly projection: OpeningBriefingProjection;
}

export interface InspectMapResult {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly playerNationId: string;
  readonly strategic: StrategicMapView;
}

export interface InspectBattleHistoryResult {
  readonly revision: number;
  readonly history: BattleHistoryView;
}

export interface CopyCampaignResult {
  readonly revision: number;
  readonly location: string;
}

export interface SaveCampaignResult {
  readonly revision: number;
}

export interface UiStateFirstMonthInspection {
  readonly status: "not_started" | "in_progress" | "completed" | "dismissed";
  readonly lastCompletedStep: number;
}

export interface UiStateInspectorLayout {
  readonly widthPx: number;
  readonly collapsed: boolean;
}

export const INSPECTOR_MIN_WIDTH_PX = 360;
export const INSPECTOR_MAX_WIDTH_PX = 560;

export interface UiStateTurnMessages {
  readonly pinnedIds: readonly string[];
  readonly readIds: readonly string[];
}

export interface UiState {
  readonly turnNumber: number;
  readonly dismissedFingerprints: readonly string[];
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  readonly inspector?: UiStateInspectorLayout;
  readonly turnMessages?: UiStateTurnMessages;
}

export interface ReadUiStateResult {
  readonly uiState: UiState;
}

export interface WriteUiStateResult {
  readonly uiState: UiState;
}

export interface MonthlyReportLedgerRow {
  readonly id: string;
  readonly description: string;
  readonly phase: string;
  readonly amount: number;
  readonly runningBalance: number;
  readonly requested?: number;
  readonly shortfall?: number;
}

export interface MonthlyReportTreasury {
  readonly openingTreasury: number;
  readonly closingTreasury: number;
  readonly maintenanceCost: number;
  readonly constructionSpending: number;
  readonly researchExpense: number;
  readonly governmentAllocation: number;
  readonly netChange: number;
  readonly ledgerRows: readonly MonthlyReportLedgerRow[];
  readonly obligationExpense?: number;
  readonly reconciliation?: LedgerReconciliation;
}

export interface MonthlyReportConstructionProgress {
  readonly projectId: string;
  readonly previousWork: number;
  readonly newWork: number;
}

export interface MonthlyReportShip {
  readonly shipId: string;
  readonly name: string;
}

export interface MonthlyReportConstruction {
  readonly projects: readonly MonthlyReportConstructionProgress[];
  readonly completedShips: readonly MonthlyReportShip[];
  readonly newlyActiveProjectIds: readonly string[];
}

export interface MonthlyReportResearchProgress {
  readonly techId: string;
  readonly previousPoints: number;
  readonly newPoints: number;
}

export interface MonthlyReportDiscovery {
  readonly techId: string;
  readonly researchFieldId: string;
}

export interface MonthlyReportResearch {
  readonly progress: readonly MonthlyReportResearchProgress[];
  readonly discoveries: readonly MonthlyReportDiscovery[];
}

export interface MonthlyReportFleet {
  readonly additions: readonly MonthlyReportShip[];
  readonly totalActiveShips: number;
}

export interface MonthlyReportPeriod {
  readonly from: { readonly year: number; readonly month: number };
  readonly to: { readonly year: number; readonly month: number };
}

export interface MonthlyReportEntry {
  readonly reportId: string;
  readonly campaignId: string;
  readonly turn: number;
  readonly period: MonthlyReportPeriod;
  readonly generatedAt: string;
  readonly treasury: MonthlyReportTreasury;
  readonly construction: MonthlyReportConstruction;
  readonly research: MonthlyReportResearch;
  readonly fleet: MonthlyReportFleet;
  readonly priorities: readonly StrategicPriority[];
  readonly battleOutcomes: readonly BattleOutcome[];
}

export interface MonthlyReports {
  readonly reports: readonly MonthlyReportEntry[];
}

export interface ReadMonthlyReportsResult {
  readonly reports: readonly MonthlyReportEntry[];
}

export type CommitMonthPayload = CampaignCommandMap["commitMonth"]["payload"];
export type GenerateBattlePayload = CampaignCommandMap["generateBattle"]["payload"];
export type ResolveBattlePayload = CampaignCommandMap["resolveBattle"]["payload"];
export type ResolveTacticalBattlePayload = CampaignCommandMap["resolveTacticalBattle"]["payload"];
export type ReplayBattleBoundaryPayload = CampaignCommandMap["replayBattleBoundary"]["payload"];
export type SeedCampaignBattleDrillPayload =
  CampaignCommandMap["seedCampaignBattleDrill"]["payload"];
export type WriteUiStatePayload = CampaignCommandMap["writeUiState"]["payload"];
export type AnswerDecisionPayload = CampaignCommandMap["answerDecision"]["payload"];
export type SubmitBattleResultPayload = CampaignCommandMap["submitBattleResult"]["payload"];
export type StartPlayerBattlePayload = CampaignCommandMap["startPlayerBattle"]["payload"];
export type AdvancePlayerBattlePayload = CampaignCommandMap["advancePlayerBattle"]["payload"];
export type FinishPlayerBattlePayload = CampaignCommandMap["finishPlayerBattle"]["payload"];
export type SubmitOfferResponsePayload = CampaignCommandMap["submitOfferResponse"]["payload"];

export interface CampaignCommandClient {
  execute<N extends CampaignCommandName>(
    command: N,
    payload: CampaignCommandMap[N]["payload"],
  ): Promise<BridgeResult<CampaignCommandMap[N]["result"]>>;
}

export interface EntityReferenceDto {
  readonly type:
    | "ship"
    | "shipClass"
    | "nation"
    | "region"
    | "technology"
    | "constructionProject"
    | "battle"
    | "formation";
  readonly id: string;
}

export interface EffectReferenceDto {
  readonly target: EntityReferenceDto;
  readonly attribute: string;
  readonly previousValue?: string | number | boolean;
  readonly newValue?: string | number | boolean;
  readonly delta?: number;
  readonly visibility: "exact" | "qualitative" | "hidden";
}

export interface TurnMessageDto {
  readonly id: string;
  readonly turnId: string;
  readonly occurredAt: string;
  readonly phase: string;
  readonly category: string;
  readonly severity: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "TRACE";
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Readonly<Record<string, string | number | boolean>>;
  readonly subjectRefs: readonly EntityReferenceDto[];
  readonly effectRefs: readonly EffectReferenceDto[];
  readonly blocking: boolean;
  readonly requiresAcknowledgement: boolean;
  readonly decisionId?: string;
  readonly battleId?: string;
  readonly deduplicationKey?: string;
  readonly aggregateKey?: string;
  readonly playerVisible: boolean;
  readonly debugMetadata?: {
    readonly sourceEventIds: readonly string[];
    readonly projectionVersion: string;
    readonly rulesetVersion: string;
    readonly contentVersion: string;
  };
}

export interface TurnSummaryEntry {
  readonly turnId: string;
  readonly projectionVersion: string;
  readonly occurredAt: string;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
  readonly messages: readonly TurnMessageDto[];
}

export interface ReadTurnSummariesResult {
  readonly summaries: readonly TurnSummaryEntry[];
}

export interface TurnSummaries {
  readonly summaries: readonly TurnSummaryEntry[];
}

export interface EffectHintDto {
  readonly target: EntityReferenceDto;
  readonly attribute: string;
  readonly direction: "increase" | "decrease" | "none";
  readonly magnitude: "minor" | "moderate" | "major";
}

export interface DecisionOptionDto {
  readonly optionId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly hints: readonly EffectHintDto[];
  readonly effects: readonly {
    readonly nationId: string;
    readonly attribute: "treasury";
    readonly delta: number;
  }[];
}

export interface InterruptionRequestDto {
  readonly kind: "decision" | "battle" | "offer";
  readonly turnId: string;
  readonly interruptionId: string;
  readonly ordinal: number;
  readonly phase: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Readonly<Record<string, string | number | boolean>>;
  readonly decisionId?: string;
  readonly options?: readonly DecisionOptionDto[];
  readonly battleId?: string;
  readonly attackerId?: string;
  readonly defenderId?: string;
  readonly areaId?: string;
  readonly missionType?: string;
  readonly acceptanceClass?: string;
  readonly playerSide?: "ATTACKER" | "DEFENDER";
  readonly playerForce?: readonly OfferForceShipDto[];
  readonly estimate?: OfferEstimateDto;
  readonly supportForcePresent?: boolean;
  readonly supportNationIds?: readonly string[];
  readonly declineStatementKeys?: readonly string[];
}

export interface OfferForceShipDto {
  readonly shipId: string;
  readonly name: string;
  readonly classId: string;
}

export interface OfferEstimateDto {
  readonly model: "EXACT" | "BANDED" | "PERTURBED";
  readonly strength: number;
}

export interface PendingTurnDto {
  readonly turnId: string;
  readonly campaignId: string;
  readonly playerNationId: string;
  readonly startingRevision: number;
  readonly nextInterruptionOrdinal: number;
  readonly recordedInputCount: number;
  readonly createdAt: string;
}

export type ResolveTurnResult =
  | {
      readonly status: "completed";
      readonly summary: TurnSummaryEntry;
      readonly closing: {
        readonly revision: number;
        readonly month: { readonly year: number; readonly month: number };
        readonly closingTreasury: number;
      };
    }
  | {
      readonly status: "suspended";
      readonly request: InterruptionRequestDto | null;
      readonly pendingTurn: PendingTurnDto;
    }
  | { readonly status: "unavailable" };

export interface ReadPendingTurnResult {
  readonly pending: PendingTurnDto | null;
  readonly valid: boolean;
}

export interface PlayerBattleDivisionOrderDto {
  readonly divisionId: string;
  readonly stance: "ENGAGE" | "HOLD" | "WITHDRAW";
  readonly speedPercent: number;
}

export interface PlayerBattleResultDto {
  readonly battleId: string;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly damageReport: Readonly<Record<string, number>>;
}

export interface StartPlayerBattleResult {
  readonly view: PlayerBattleView;
  readonly sessionHash: string;
  readonly resumed: boolean;
  readonly lastOrders: readonly PlayerBattleDivisionOrderDto[];
}

export interface AdvancePlayerBattleResult {
  readonly view: PlayerBattleView;
  readonly sessionHash: string;
  readonly result: PlayerBattleResultDto | null;
}

export interface FinishPlayerBattleResult {
  readonly result: PlayerBattleResultDto;
}

export interface AbandonPendingTurnResult {
  readonly abandoned: boolean;
}
