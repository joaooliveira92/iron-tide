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
import type { PlayerBattleView } from "@bluewave/combat";
import type { BridgeResult } from "./bridge-contract.js";
import type { CampaignCommandMap, CampaignCommandName } from "./campaign-command-descriptors.js";

export type { CampaignCommandMap, CampaignCommandName } from "./campaign-command-descriptors.js";

/**
 * Request payloads for the simulation domain (battle-related types live in
 * `@bluewave/campaign-engine` alongside their results, grounded in real
 * screen usage per ticket 09's addendum).
 */

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

/**
 * Debug-only Campaign Battle Drill payload (desktop E2E acceptance slice).
 * Prepares the LIVE campaign session so the real month phases
 * (`battle_generation` + `battle_resolution`) generate and resolve a battle:
 * it co-locates the war's completed fleets, scales their `firepower` for the
 * engine's eligibility floors only, and persists the mutated snapshot as the
 * live session state. Gated by `isBattleSandboxEnabled()` (DEBUG_ONLY otherwise)
 * and validated at the IPC boundary.
 */
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
  /** The session's player nation: the viewer the strategic projection is scoped to. */
  readonly playerNationId: string;
  /** Viewer-scoped world (DR-0037 Option B: own fleets plus public facts). */
  readonly strategic: StrategicMapView;
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
 * Payload aliases derived from the single descriptor table in
 * `campaign-command-descriptors.ts`. They stay exported for call sites that name
 * a payload explicitly; the values themselves live only in the table.
 */
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
  /** Offer only (T-1 08): the nations whose ships form the support force; absent when there is none. */
  readonly supportNationIds?: readonly string[];
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
  /** True when the battle was resumed from a mid-battle save (its orders replayed). */
  readonly resumed: boolean;
  /** The standing orders in force at the resume point (empty for a fresh battle). */
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
