import type {
  BattleManifest,
  BattleOutcome,
  BattleResolution,
  CampaignConfiguration,
  CommitMonthResponse,
  InspectPrioritiesResult,
  LedgerReconciliation,
  OpeningBriefingProjection,
  PlayerProjection,
  RandomDecisionRecord,
  RawScriptedForceOrder,
  ReplayBattleBoundaryResponse,
  StrategicPriority,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";
import type { BattleHistoryView, WorldMapView } from "@bluewave/campaign-engine";
import type { SaveMetadata } from "@bluewave/persistence";
import type { BridgeResult, CommandEnvelope } from "./bridge-contract.js";
import type {
  DesignCommandOutcome,
  LoadProjectDraftPayload,
  ReadDrawingBoardDraftResult,
  WriteDrawingBoardDraftPayload,
  LoadShipDraftPayload,
  ProjectDraftView,
  RebuildableShipView,
  RebuildCheckPayload,
  RebuildCheckView,
  RebuildCommandOutcome,
  ReviseCommandOutcome,
  ReviseProjectCommandPayload,
  ShipDraftView,
  StartRebuildCommandPayload,
  SubmitDesignCommandPayload,
} from "./design-contract.js";
import type {
  LoadCampaignResponse,
  RecentCampaignEntry,
  RecoverCampaignResponse,
  ReplayCampaignResponse,
  VerifyCampaignResponse,
} from "./continuity-contract.js";
import type { NewGameOptions } from "./new-game-contract.js";
import type {
  AuthorizeDockExpansionCommandPayload,
  CancelConstructionCommandPayload,
  ConstructionBatchPreviewOutcome,
  ConstructionCommandOutcome,
  ConstructionCommandQueuedOutcome,
  ConstructionScreenProjection,
  CancelConstructionProjectCommandPayload,
  ForeignConstructionPreviewOutcome,
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
import type {
  CancelMovementCommandPayload,
  FleetScreenProjection,
  MovementCommandOutcome,
  StationAssignmentOutcome,
  SubmitStationAssignmentPayload,
  ReplaceMovementCommandPayload,
  SubmitMovementCommandPayload,
} from "./fleet-contract.js";
import type {
  BudgetCommandOutcome,
  BudgetScreenProjection,
  SubmitBudgetAllocationPayload,
} from "./budget-contract.js";
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
  ResearchPriorityOutcome,
  ResearchScreenProjection,
  SetResearchPriorityCommandPayload,
} from "./research-contract.js";

/**
 * Request payloads for the simulation domain (battle-related types live in
 * `@bluewave/campaign-engine` alongside their results, grounded in real
 * screen usage per ticket 09's addendum).
 */

export type CommitMonthPayload = CommandEnvelope;

export interface GenerateBattlePayload {
  readonly sessionId: string;
  /**
   * The war to generate an engagement for. Omitted by the Simulation Battle
   * Arena, which lets the command auto-select the player's first active war; the
   * Tactical Sandbox passes the war id typed into its setup form.
   */
  readonly warId?: string;
}

export interface GenerateBattleResult {
  readonly manifest: BattleManifest;
  readonly randomDecisions: readonly RandomDecisionRecord[];
}

export interface ResolveBattlePayload {
  readonly sessionId: string;
  readonly battleId: string;
}

export interface ResolveBattleResult {
  readonly resolution: BattleResolution;
}

export interface ResolveTacticalBattlePayload {
  readonly sessionId: string;
  readonly battleId: string;
  readonly turnCount: number;
  readonly scriptedOrders: readonly RawScriptedForceOrder[];
}

export interface ResolveTacticalBattleResult {
  readonly outcome: TacticalBattleOutcome;
  readonly randomDecisions?: readonly RandomDecisionRecord[];
}

export interface ReplayBattleBoundaryPayload {
  readonly sessionId: string;
  readonly battleId: string;
}

/**
 * Debug-only Campaign Battle Drill payload (desktop E2E acceptance slice).
 * Prepares the LIVE campaign session so the real month phases
 * (`battle_generation` + `battle_resolution`) generate and resolve a battle:
 * it co-locates the war's completed fleets, scales their `firepower` for the
 * engine's eligibility floors only, and persists the mutated snapshot as the
 * live session state. Gated by `isBattleSandboxEnabled()` (DEBUG_ONLY otherwise)
 * and validated at the IPC boundary.
 */
export interface SeedCampaignBattleDrillPayload {
  readonly sessionId: string;
  /** The war to stage. Omitted → the player's first active war (deterministic). */
  readonly warId?: string;
}

export interface SeedCampaignBattleDrillResult {
  readonly warId: string;
  readonly areaId: string;
  readonly strengthScale: number;
  /** True when the attacker fleets had to be relocated to reach the defender. */
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
  readonly world: WorldMapView;
}

export interface InspectBattleHistoryResult {
  readonly revision: number;
  readonly history: BattleHistoryView;
}

export interface CopyCampaignResult {
  readonly revision: number;
  /** Where the copy was written. */
  readonly location: string;
}

export interface SaveCampaignResult {
  readonly revision: number;
}

/**
 * Renderer-owned UI state persisted per-campaign in `ui-state.json` (spec §7
 * "Dismissal" + §8 "Persistence"). One sidecar serves BOTH priority-dismissal
 * and first-month-inspection state. It is **never authoritative** — it is not
 * part of the save envelope/hash and is never fed into `MonthExecutor`
 * (ENGINEERING-CONTRACT: "React and UI state are never authoritative
 * simulation state"). Expiry is inherent: `dismissedFingerprints` are only
 * honored while `turnNumber` equals the session's current turn (they expire on
 * turn advance); `firstMonthInspection` does not expire (once
 * completed/dismissed, reopening stays disabled across turns).
 */
export interface UiStateFirstMonthInspection {
  readonly status: "not_started" | "in_progress" | "completed" | "dismissed";
  readonly lastCompletedStep: number;
}

/**
 * The shipbuilding inspector's remembered layout — the pane's width and whether it is folded away.
 * Presentation-only (ADR-0038): it never influences simulation and is never read by `MonthExecutor`.
 */
export interface UiStateInspectorLayout {
  /** The pane's chosen width in CSS pixels; the renderer clamps it to the supported range. */
  readonly widthPx: number;
  /** Whether the pane is collapsed to its restore strip. */
  readonly collapsed: boolean;
}

/** The inspector pane's width bounds, in CSS pixels — one source for the wire schema and the renderer. */
export const INSPECTOR_MIN_WIDTH_PX = 360;
export const INSPECTOR_MAX_WIDTH_PX = 560;

/** Pin/read state for turn-summary messages — never deletes the underlying message. */
export interface UiStateTurnMessages {
  readonly pinnedIds: readonly string[];
  readonly readIds: readonly string[];
}

export interface UiState {
  /** The turn the sidecar was last written at. */
  readonly turnNumber: number;
  /** Dismissal fingerprints (spec §7) — honored only while
   * `turnNumber === currentTurnNumber`. */
  readonly dismissedFingerprints: readonly string[];
  /** Guided first-month inspection state (§8) — persists across turns. */
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  /** Shipbuilding inspector layout — persists per campaign, never authoritative. */
  readonly inspector?: UiStateInspectorLayout;
  /** Turn-summary pin/read state — persists per campaign, never authoritative. */
  readonly turnMessages?: UiStateTurnMessages;
}

export interface ReadUiStateResult {
  readonly uiState: UiState;
}

/**
 * Write payload for `writeUiState`. Merge semantics: the sidecar serves BOTH
 * priority-dismissal (§7) and first-month-inspection (§8) state, and a write
 * only touches the fields it carries — `dismissedFingerprints` is a
 * complete-set replace, while an ABSENT `firstMonthInspection` is carried
 * forward from the stored sidecar (so a dismissal-only writer never erases
 * inspection progress and vice-versa). An explicit inspection reset is
 * available by sending `{ status: "not_started", lastCompletedStep: 0 }`.
 */
export interface WriteUiStatePayload {
  readonly sessionId: string;
  readonly dismissedFingerprints: readonly string[];
  readonly firstMonthInspection?: UiStateFirstMonthInspection;
  /** Shipbuilding inspector layout; absent means carried forward from the stored sidecar. */
  readonly inspector?: UiStateInspectorLayout;
  /** Turn-summary pin/read state; absent means carried forward from the stored sidecar. */
  readonly turnMessages?: UiStateTurnMessages;
}

export interface WriteUiStateResult {
  readonly uiState: UiState;
}

/** One real ledger row of a stored monthly report (spec §16 Treasury). */
export interface MonthlyReportLedgerRow {
  readonly id: string;
  readonly description: string;
  readonly phase: string;
  /** The row's balance movement (`newBalance − previousBalance`). */
  readonly amount: number;
  readonly runningBalance: number;
  /** Outflows only (spec #138): what the rules asked for; `amount` carries what was paid. Absent on older reports. */
  readonly requested?: number;
  /** Outflows only: `requested - paid`, a recorded non-carried shortfall. Absent on older reports. */
  readonly shortfall?: number;
}

/** The month's real treasury figures plus the two ledger-derived lines (spec §16). */
export interface MonthlyReportTreasury {
  readonly openingTreasury: number;
  readonly closingTreasury: number;
  readonly maintenanceCost: number;
  readonly constructionSpending: number;
  /** Derived from the real ledger `RESEARCH_EXPENDITURE` category. */
  readonly researchExpense: number;
  /** Derived from the real ledger `NAVAL_APPROPRIATION` category. */
  readonly governmentAllocation: number;
  /** `closingTreasury − openingTreasury`. */
  readonly netChange: number;
  /** The real player ledger rows — render the ledger, never an invented balancing row. */
  readonly ledgerRows: readonly MonthlyReportLedgerRow[];
  /** Paid fixed obligations, from the ledger `OBLIGATION` category. Absent on reports stored before spec #138. */
  readonly obligationExpense?: number;
  /** The month's reconciliation line (spec #138 G2). Absent on reports stored before it existed. */
  readonly reconciliation?: LedgerReconciliation;
}

/** One `ConstructionProgressed` event's per-project work delta. */
export interface MonthlyReportConstructionProgress {
  readonly projectId: string;
  readonly previousWork: number;
  readonly newWork: number;
}

/** A ship identity captured from the authoritative fleet snapshot. */
export interface MonthlyReportShip {
  readonly shipId: string;
  readonly name: string;
}

export interface MonthlyReportConstruction {
  /** Per-project work progress from the real `ConstructionProgressed` events. */
  readonly projects: readonly MonthlyReportConstructionProgress[];
  /** Ships that left `isUnderConstruction` this month (pre→post fleet delta). */
  readonly completedShips: readonly MonthlyReportShip[];
  /** Projects whose status became `ACTIVE` this month (pre→post delta). */
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
  /** Per-tech progress from the real `ResearchProgressed` events. */
  readonly progress: readonly MonthlyReportResearchProgress[];
  /** Discoveries from the real `TechnologyDiscovered` events. */
  readonly discoveries: readonly MonthlyReportDiscovery[];
}

export interface MonthlyReportFleet {
  /** Fleet additions this month (the newly commissioned ships). */
  readonly additions: readonly MonthlyReportShip[];
  /** Active (non-under-construction) ship total on the post-month snapshot. */
  readonly totalActiveShips: number;
}

export interface MonthlyReportPeriod {
  /** The resolved month (`MonthReport.month`). */
  readonly from: { readonly year: number; readonly month: number };
  /** The new month (`advanceMonth`). */
  readonly to: { readonly year: number; readonly month: number };
}

/**
 * The thin, real-fields-only derived view of one committed month (spec §16
 * "Report data model"): the real `CommitMonthResponse` plus the ledger/event/
 * snapshot derivations. Main builds it from the authoritative month result and
 * the renderer renders it read-only. No invented fields — every number comes
 * from `MonthReport` / `financialLedger` / `domainEvents` / `closingSnapshot` /
 * `buildPrioritiesProjection`. The CUT sections (Diplomacy, research
 * budget-effectiveness + settings effects, per-ship maintenance effect,
 * construction "stalled") are deliberately absent, not empty.
 */
export interface MonthlyReportEntry {
  /** The month's save identity (`SaveMetadata.saveId`). */
  readonly reportId: string;
  readonly campaignId: string;
  /** The post-month snapshot revision (`nextTurnNumber`). */
  readonly turn: number;
  readonly period: MonthlyReportPeriod;
  /**
   * Real persistence metadata (`SaveMetadata.timestamp`) — never `Date.now()`
   * inside an authoritative path. The report is app-layer and never hashed.
   */
  readonly generatedAt: string;
  readonly treasury: MonthlyReportTreasury;
  readonly construction: MonthlyReportConstruction;
  readonly research: MonthlyReportResearch;
  readonly fleet: MonthlyReportFleet;
  /** The INC-2 projection over the post-month snapshot (its fingerprints are included). */
  readonly priorities: readonly StrategicPriority[];
  /** The real `closingSnapshot.battleOutcomes` (plain text, no tactical UI). */
  readonly battleOutcomes: readonly BattleOutcome[];
}

/**
 * The `monthly-reports.json` sidecar shape (spec §16 "Report history"). The
 * most recent reports, newest first, pruned to `MONTHLY_REPORTS_LIMIT` at
 * write. It is **never authoritative**: a sibling of the save directory, not
 * part of the envelope/hash, never read by `MonthExecutor`.
 */
export interface MonthlyReports {
  readonly reports: readonly MonthlyReportEntry[];
}

export interface ReadMonthlyReportsResult {
  readonly reports: readonly MonthlyReportEntry[];
}

/**
 * Single source of truth for the command name set — `campaignBridge.ts`'s
 * runtime registry derives from this instead of hand-duplicating the list.
 * Keep its entries in sync with {@link CampaignCommandMap}.
 */
export const CAMPAIGN_COMMAND_NAMES = [
  "listNewGameOptions",
  "compileCampaign",
  "inspectCampaign",
  "inspectOpeningBriefing",
  "inspectMap",
  "inspectBattleHistory",
  "inspectPriorities",
  "inspectDrawingBoardContent",
  "inspectPresentationContent",
  "inspectUiCatalogue",
  "closeCampaign",
  "saveCampaign",
  "copyCampaign",
  "commitMonth",
  "generateBattle",
  "resolveBattle",
  "resolveTacticalBattle",
  "replayBattleBoundary",
  "seedCampaignBattleDrill",
  "loadCampaign",
  "loadRecentCampaign",
  "listRecentCampaigns",
  "removeRecentCampaign",
  "listCampaigns",
  "verifyCampaign",
  "replayCampaign",
  "recoverCampaign",
  "inspectConstructionScreen",
  "submitConstructionCommand",
  "replaceConstructionCommand",
  "cancelConstructionCommand",
  "haltConstructionCommand",
  "resumeConstructionCommand",
  "setAccelerationCommand",
  "cancelConstructionProjectCommand",
  "orderConstructionBatchCommand",
  "previewConstructionBatchCommand",
  "authorizeDockExpansionCommand",
  "placeForeignConstructionCommand",
  "previewForeignConstructionCommand",
  "inspectFleetScreen",
  "submitMovementCommand",
  "submitStationAssignment",
  "replaceMovementCommand",
  "cancelMovementCommand",
  "submitDesignCommand",
  "reviseProjectCommand",
  "loadProjectDraft",
  "readDrawingBoardDraft",
  "writeDrawingBoardDraft",
  "listRebuildableShips",
  "loadShipDraft",
  "checkRebuild",
  "startRebuildCommand",
  "inspectResearchScreen",
  "setResearchPriorityCommand",
  "inspectDiplomacyScreen",
  "inspectDivisionScreen",
  "submitDivisionCommand",
  "inspectBudgetScreen",
  "submitBudgetAllocation",
  "submitDiplomacyCommand",
  "readUiState",
  "writeUiState",
  "readMonthlyReports",
  "readTurnSummaries",
  "resolveTurn",
  "answerDecision",
  "submitBattleResult",
  "submitOfferResponse",
  "abandonPendingTurn",
  "readPendingTurn",
] as const;

/**
 * The command-descriptor registry: one entry per command, mapping each name to
 * its payload and result types. Adding a command is one line here, plus one
 * entry in {@link CAMPAIGN_COMMAND_NAMES} and its handler module — no overload
 * to write.
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
  commitMonth: { readonly payload: CommitMonthPayload; readonly result: CommitMonthResponse };
  generateBattle: {
    readonly payload: GenerateBattlePayload;
    readonly result: GenerateBattleResult;
  };
  resolveBattle: { readonly payload: ResolveBattlePayload; readonly result: ResolveBattleResult };
  resolveTacticalBattle: {
    readonly payload: ResolveTacticalBattlePayload;
    readonly result: ResolveTacticalBattleResult;
  };
  replayBattleBoundary: {
    readonly payload: ReplayBattleBoundaryPayload;
    readonly result: ReplayBattleBoundaryResponse;
  };
  seedCampaignBattleDrill: {
    readonly payload: SeedCampaignBattleDrillPayload;
    readonly result: SeedCampaignBattleDrillResult;
  };
  loadCampaign: { readonly payload: undefined; readonly result: LoadCampaignResponse };
  listRecentCampaigns: {
    readonly payload: undefined;
    readonly result: readonly RecentCampaignEntry[];
  };
  removeRecentCampaign: {
    readonly payload: { readonly packagePath: string };
    readonly result: readonly RecentCampaignEntry[];
  };
  loadRecentCampaign: {
    readonly payload: { readonly packagePath: string };
    readonly result: LoadCampaignResponse;
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
  cancelMovementCommand: {
    readonly payload: CancelMovementCommandPayload;
    readonly result: MovementCommandOutcome;
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
  resolveTurn: { readonly payload: CommitMonthPayload; readonly result: ResolveTurnResult };
  answerDecision: { readonly payload: AnswerDecisionPayload; readonly result: ResolveTurnResult };
  submitBattleResult: {
    readonly payload: SubmitBattleResultPayload;
    readonly result: ResolveTurnResult;
  };
  submitOfferResponse: {
    readonly payload: SubmitOfferResponsePayload;
    readonly result: ResolveTurnResult;
  };
  abandonPendingTurn: { readonly payload: string; readonly result: AbandonPendingTurnResult };
  readPendingTurn: { readonly payload: string; readonly result: ReadPendingTurnResult };
}

export type CampaignCommandName = keyof CampaignCommandMap;

/**
 * The full `bridge.campaign` surface — a single generic `execute` whose
 * payload/result types come from {@link CampaignCommandMap}. Adding a command
 * is one line in the map, one entry in {@link CAMPAIGN_COMMAND_NAMES}, and
 * its handler module — no overload to write or update across files.
 */
export interface CampaignCommandClient {
  execute<N extends CampaignCommandName>(
    command: N,
    payload: CampaignCommandMap[N]["payload"],
  ): Promise<BridgeResult<CampaignCommandMap[N]["result"]>>;
}

/** A stable reference to a domain entity a message concerns (renderer-safe mirror). */
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

/** One resolved turn's projected, player-visible messages (non-authoritative). */
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

/** The tolerant-read sidecar shape: the most recent summaries, newest first. */
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

/** An interruption the player must resolve before the turn can continue. */
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
  /** Offer only (T-1 03, spec #109 R4): the registry mission type and its acceptance class. */
  readonly missionType?: string;
  readonly acceptanceClass?: string;
  /** Offer only: which side the player's nation is on. */
  readonly playerSide?: "ATTACKER" | "DEFENDER";
  /** Offer only: the player's own selected force. The enemy force is never carried. */
  readonly playerForce?: readonly OfferForceShipDto[];
  /** Offer only: the enemy-strength estimate. It is an estimate, never the true strength. */
  readonly estimate?: OfferEstimateDto;
  /** Offer only: whether a friendly support force is present. */
  readonly supportForcePresent?: boolean;
  /** Offer only: the message keys of the qualitative decline statement. */
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

/** The non-authoritative pending-turn record summary the renderer may show. */
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
      /** The post-turn closing surface, so the header can update without a refresh round-trip. */
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
  /**
   * Whether the stored pending turn can be trusted against the already-verified
   * save (recomputed turn id + matching versions/content hashes). A stored but
   * incompatible record must be reported as unavailable without being resumed or
   * migrated.
   */
  readonly valid: boolean;
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

/** The player's answer to a battle offer (T-1 03, T-1 04): accept, delegate to staff, or decline. */
export interface SubmitOfferResponsePayload {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly transportRequestId: string;
  readonly interruptionId: string;
  readonly battleId: string;
  readonly response: "accept" | "delegate" | "decline";
}

export interface AbandonPendingTurnResult {
  readonly abandoned: boolean;
}
