import type {
  BattleManifest,
  BattleOutcome,
  BattleResolution,
  CampaignConfiguration,
  CommitMonthResponse,
  InspectPrioritiesResult,
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
 * TypeScript can't generate overload signatures from a runtime tuple, so
 * `CampaignCommandClient` below must still list each command by hand; keep
 * the two in sync when adding a command (a mismatch fails
 * `campaignBridge.test.ts`).
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
] as const;

/**
 * The full `bridge.campaign` surface — one overload per command, grounded
 * in every real call site across the screens (desktop-mvp map tickets
 * 07-10). Overloaded (not a single generic `execute<Value>`) so call sites
 * get the correct result type from the command's literal string alone,
 * matching how every screen already calls it.
 */
export interface CampaignCommandClient {
  execute(command: "listNewGameOptions", payload: undefined): Promise<BridgeResult<NewGameOptions>>;
  execute(
    command: "compileCampaign",
    payload: CampaignConfiguration,
  ): Promise<BridgeResult<CompileCampaignResult>>;
  execute(
    command: "inspectCampaign",
    payload: string,
  ): Promise<BridgeResult<InspectCampaignResult>>;
  execute(
    command: "inspectOpeningBriefing",
    payload: string,
  ): Promise<BridgeResult<InspectOpeningBriefingResult>>;
  execute(command: "inspectMap", payload: string): Promise<BridgeResult<InspectMapResult>>;
  execute(
    command: "inspectBattleHistory",
    payload: string,
  ): Promise<BridgeResult<InspectBattleHistoryResult>>;
  execute(
    command: "inspectPriorities",
    payload: string,
  ): Promise<BridgeResult<InspectPrioritiesResult>>;
  execute(
    command: "inspectDrawingBoardContent",
    payload: undefined,
  ): Promise<BridgeResult<DrawingBoardContentDto>>;
  execute(
    command: "inspectPresentationContent",
    payload: undefined,
  ): Promise<BridgeResult<PresentationContentDto>>;
  execute(command: "inspectUiCatalogue", payload: undefined): Promise<BridgeResult<UiCatalogueDto>>;
  execute(command: "closeCampaign", payload: string): Promise<BridgeResult<unknown>>;
  execute(command: "saveCampaign", payload: string): Promise<BridgeResult<SaveCampaignResult>>;
  execute(command: "copyCampaign", payload: string): Promise<BridgeResult<CopyCampaignResult>>;
  execute(
    command: "commitMonth",
    payload: CommitMonthPayload,
  ): Promise<BridgeResult<CommitMonthResponse>>;
  execute(
    command: "generateBattle",
    payload: GenerateBattlePayload,
  ): Promise<BridgeResult<GenerateBattleResult>>;
  execute(
    command: "resolveBattle",
    payload: ResolveBattlePayload,
  ): Promise<BridgeResult<ResolveBattleResult>>;
  execute(
    command: "resolveTacticalBattle",
    payload: ResolveTacticalBattlePayload,
  ): Promise<BridgeResult<ResolveTacticalBattleResult>>;
  execute(
    command: "replayBattleBoundary",
    payload: ReplayBattleBoundaryPayload,
  ): Promise<BridgeResult<ReplayBattleBoundaryResponse>>;
  execute(
    command: "seedCampaignBattleDrill",
    payload: SeedCampaignBattleDrillPayload,
  ): Promise<BridgeResult<SeedCampaignBattleDrillResult>>;
  execute(command: "loadCampaign", payload: undefined): Promise<BridgeResult<LoadCampaignResponse>>;
  execute(
    command: "listCampaigns",
    payload: undefined,
  ): Promise<BridgeResult<readonly SaveMetadata[]>>;
  execute(
    command: "verifyCampaign",
    payload: undefined,
  ): Promise<BridgeResult<VerifyCampaignResponse>>;
  execute(
    command: "replayCampaign",
    payload: undefined,
  ): Promise<BridgeResult<ReplayCampaignResponse>>;
  execute(
    command: "recoverCampaign",
    payload: undefined,
  ): Promise<BridgeResult<RecoverCampaignResponse>>;
  execute(
    command: "inspectConstructionScreen",
    payload: string,
  ): Promise<BridgeResult<ConstructionScreenProjection>>;
  execute(
    command: "submitConstructionCommand",
    payload: SubmitConstructionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandOutcome>>;
  execute(
    command: "replaceConstructionCommand",
    payload: ReplaceConstructionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandOutcome>>;
  execute(
    command: "cancelConstructionCommand",
    payload: CancelConstructionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandOutcome>>;
  execute(
    command: "haltConstructionCommand",
    payload: HaltConstructionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "resumeConstructionCommand",
    payload: ResumeConstructionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "setAccelerationCommand",
    payload: SetAccelerationCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "cancelConstructionProjectCommand",
    payload: CancelConstructionProjectCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "orderConstructionBatchCommand",
    payload: OrderConstructionBatchCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "previewConstructionBatchCommand",
    payload: PreviewConstructionBatchCommandPayload,
  ): Promise<BridgeResult<ConstructionBatchPreviewOutcome>>;
  execute(
    command: "authorizeDockExpansionCommand",
    payload: AuthorizeDockExpansionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "placeForeignConstructionCommand",
    payload: PlaceForeignConstructionCommandPayload,
  ): Promise<BridgeResult<ConstructionCommandQueuedOutcome>>;
  execute(
    command: "previewForeignConstructionCommand",
    payload: PreviewForeignConstructionCommandPayload,
  ): Promise<BridgeResult<ForeignConstructionPreviewOutcome>>;
  execute(
    command: "inspectFleetScreen",
    payload: string,
  ): Promise<BridgeResult<FleetScreenProjection>>;
  execute(
    command: "submitMovementCommand",
    payload: SubmitMovementCommandPayload,
  ): Promise<BridgeResult<MovementCommandOutcome>>;
  execute(
    command: "replaceMovementCommand",
    payload: ReplaceMovementCommandPayload,
  ): Promise<BridgeResult<MovementCommandOutcome>>;
  execute(
    command: "submitDesignCommand",
    payload: SubmitDesignCommandPayload,
  ): Promise<BridgeResult<DesignCommandOutcome>>;
  execute(
    command: "reviseProjectCommand",
    payload: ReviseProjectCommandPayload,
  ): Promise<BridgeResult<ReviseCommandOutcome>>;
  execute(
    command: "loadProjectDraft",
    payload: LoadProjectDraftPayload,
  ): Promise<BridgeResult<ProjectDraftView>>;
  execute(
    command: "readDrawingBoardDraft",
    payload: string,
  ): Promise<BridgeResult<ReadDrawingBoardDraftResult>>;
  execute(
    command: "writeDrawingBoardDraft",
    payload: WriteDrawingBoardDraftPayload,
  ): Promise<BridgeResult<{ readonly saved: boolean }>>;
  execute(
    command: "listRebuildableShips",
    payload: string,
  ): Promise<BridgeResult<readonly RebuildableShipView[]>>;
  execute(
    command: "loadShipDraft",
    payload: LoadShipDraftPayload,
  ): Promise<BridgeResult<ShipDraftView>>;
  execute(
    command: "checkRebuild",
    payload: RebuildCheckPayload,
  ): Promise<BridgeResult<RebuildCheckView>>;
  execute(
    command: "startRebuildCommand",
    payload: StartRebuildCommandPayload,
  ): Promise<BridgeResult<RebuildCommandOutcome>>;
  execute(
    command: "cancelMovementCommand",
    payload: CancelMovementCommandPayload,
  ): Promise<BridgeResult<MovementCommandOutcome>>;
  execute(
    command: "inspectResearchScreen",
    payload: string,
  ): Promise<BridgeResult<ResearchScreenProjection>>;
  execute(
    command: "setResearchPriorityCommand",
    payload: SetResearchPriorityCommandPayload,
  ): Promise<BridgeResult<ResearchPriorityOutcome>>;
  execute(
    command: "inspectDiplomacyScreen",
    payload: string,
  ): Promise<BridgeResult<DiplomacyScreenProjection>>;
  execute(
    command: "submitDiplomacyCommand",
    payload: SubmitDiplomacyCommandPayload,
  ): Promise<BridgeResult<DiplomacyCommandOutcome>>;
  execute(
    command: "inspectDivisionScreen",
    payload: string,
  ): Promise<BridgeResult<DivisionScreenProjection>>;
  execute(
    command: "submitDivisionCommand",
    payload: SubmitDivisionCommandPayload,
  ): Promise<BridgeResult<DivisionCommandOutcome>>;
  execute(
    command: "inspectBudgetScreen",
    payload: string,
  ): Promise<BridgeResult<BudgetScreenProjection>>;
  execute(
    command: "submitBudgetAllocation",
    payload: SubmitBudgetAllocationPayload,
  ): Promise<BridgeResult<BudgetCommandOutcome>>;
  execute(command: "readUiState", payload: string): Promise<BridgeResult<ReadUiStateResult>>;
  execute(
    command: "writeUiState",
    payload: WriteUiStatePayload,
  ): Promise<BridgeResult<WriteUiStateResult>>;
  execute(
    command: "readMonthlyReports",
    payload: string,
  ): Promise<BridgeResult<ReadMonthlyReportsResult>>;
}
