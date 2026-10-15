import type { CompiledDesignVersion } from "./design.js";

/**
 * MVP scope, per the desktop-mvp map (ticket 09): `commitMonth` auto-resolves
 * any triggered battle inline. `CommitMonthResponse`/`MonthReport` are real,
 * implemented types. Everything else in this file (`BattleManifest` through
 * `LandTargetDamage`) is dev-tool-only surface shared with Tactical
 * Sandbox — typed accurately enough for the existing screens to compile,
 * but not wired to real commands until tactical play is in scope.
 */

export interface MonthReportPeriod {
  readonly month: number;
  readonly year: number;
}

export interface MonthReport {
  readonly month: MonthReportPeriod;
  readonly openingTreasury: number;
  readonly maintenanceCost: number;
  readonly newConstructionSpending: number;
  readonly closingTreasury: number;
}

export interface DomainEvent {
  readonly id: string;
  readonly kind: string;
  readonly phase: string;
  readonly message: string;
}

export interface FinancialLedgerEntry {
  readonly id: string;
  readonly description: string;
  readonly phase: string;
  readonly amount: number;
  readonly runningBalance: number;
}

/** Grounded in `EngineAuditInspector.tsx`'s table rendering. */
export interface RandomDecisionRecord {
  readonly purpose: string;
  readonly phase: string;
  readonly entityKey: string;
  readonly value: number;
  readonly outcome: string;
}

/**
 * Flat, vanilla-safe (web-renderable) summary of one month's auto-resolved
 * battle. Grounded in the engine's `BattleResult`/`BattleInstance` surface but
 * shaped for the renderer: no nested element instances, no mutable references.
 * A battle that ends without a decisive winner/loser carries
 * `winnerId`/`loserId` as `null` (bridge must not fabricate a result).
 */
export interface BattleOutcome {
  readonly battleId: string;
  readonly areaId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly warScoreDelta: number;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly explanation: readonly string[];
}

export interface ClosingSnapshotSummary {
  readonly revision: number;
  readonly month: MonthReportPeriod;
  readonly submarinePools: readonly SubmarinePool[];
  readonly minePressure: readonly MinePressure[];
  readonly landTargetDamage: readonly LandTargetDamage[];
  readonly battleOutcomes: readonly BattleOutcome[];
  readonly activeWars: readonly unknown[];
}

/**
 * Grounded directly in `useSimulationScreen.ts`'s `handleAdvanceTurn`
 * (reads `randomDecisions`/`closingSnapshot` at the top level) and
 * `TurnReportTab.tsx`/`TreasuryGrid.tsx` (reads `report`/`domainEvents`/
 * `financialLedger`) — both are real consumers of the same response.
 */
export interface CommitMonthResponse {
  readonly report: MonthReport;
  readonly domainEvents: readonly DomainEvent[];
  readonly financialLedger: readonly FinancialLedgerEntry[];
  readonly randomDecisions: readonly RandomDecisionRecord[];
  readonly closingSnapshot: ClosingSnapshotSummary;
}

// --- Dev-tool-only, unimplemented for MVP (ticket 09) ---

export interface BattleParticipant {
  readonly shipId: string;
  readonly divisionId: string;
  readonly nationId: string;
}

export interface BattleSide {
  readonly sideId: string;
  readonly nationId: string;
  readonly participants: readonly BattleParticipant[];
}

/** Milestone-3+ element-instantiation audit trail — dev-tool-only, grounded in `tactical-sandbox-screen-state.test.ts`. */
export interface BattleElementInstantiation {
  readonly step: string;
  readonly outcome: string;
  readonly reason: string;
  readonly coastalElementCount: number;
  readonly coastalElementReason: string;
  readonly submarineElementCount: number;
  readonly submarineElementReason: string;
  readonly mineElementCount: number;
  readonly mineElementReason: string;
  readonly airElementCount: number;
  readonly airElementReason: string;
  readonly missileElementCount: number;
  readonly missileElementReason: string;
  readonly samCiwsElementCount: number;
  readonly samCiwsElementReason: string;
  readonly jetElementCount: number;
  readonly jetElementReason: string;
  readonly radarElementCount: number;
  readonly radarElementReason: string;
  readonly ewElementCount: number;
  readonly ewElementReason: string;
}

export interface BattleManifest {
  readonly battleId: string;
  readonly warId: string;
  readonly missionType: string;
  readonly areaId: string;
  readonly month: MonthReportPeriod;
  readonly sides: readonly BattleSide[];
  readonly elementInstantiation: BattleElementInstantiation;
  readonly manifestHash: string;
}

export interface MissionOutcome {
  readonly winner: string | null;
  readonly outcomeKind: string;
}

export interface BattleForceShipOutcome {
  readonly shipId: string;
  readonly outcome: string;
}

export interface BattleForceReport {
  readonly ships: readonly BattleForceShipOutcome[];
}

export interface BattleResolution {
  readonly battleId: string;
  readonly missionOutcome: MissionOutcome;
  readonly warScoreChange: number;
  readonly attacker: BattleForceReport;
  readonly defender: BattleForceReport;
}

export interface TacticalWeatherReport {
  readonly seaState: number;
  readonly visibilityNm: number;
  readonly precipitation: string;
  readonly timeOfDay: string;
}

export interface GunneryShot {
  readonly shooterShipId: string;
  readonly targetShipId: string;
  readonly hit: boolean;
  readonly armorOutcome: string;
}

export interface GunneryResolution {
  readonly turn: number;
  readonly divisionId: string;
  readonly targetDivisionId: string;
  readonly shots: readonly GunneryShot[];
}

export interface TorpedoFiring {
  readonly turn: number;
  readonly shipId: string;
  readonly targetShipId: string;
  readonly hit: boolean;
}

export interface TacticalBattleReport {
  readonly torpedoExpenditure: readonly TorpedoFiring[];
}

export interface MineStrikeEvent {
  readonly turn: number;
  readonly shipId: string;
  readonly damageState: string;
}

export interface SubmarineElementLoss {
  readonly poolId: string;
  readonly losses: number;
}

export interface TacticalBattleEvent {
  readonly turn: number;
  readonly eventType: string;
  readonly data: unknown;
}

export interface TacticalBattleEventLedger {
  readonly events: readonly TacticalBattleEvent[];
}

export interface TacticalBattleOutcome {
  readonly battleId: string;
  readonly turnsResolved: number;
  readonly endCondition: string;
  readonly warScoreChange: number;
  readonly rejectedOrders: readonly unknown[];
  readonly weather: TacticalWeatherReport;
  readonly gunneryResults: readonly GunneryResolution[];
  readonly battleReport: TacticalBattleReport;
  readonly mineStrikeEvents?: readonly MineStrikeEvent[];
  readonly submarineElementLosses?: readonly SubmarineElementLoss[];
  readonly battleEventLedger: TacticalBattleEventLedger;
}

export interface SubmarinePool {
  readonly poolId: string;
  readonly nationId: string;
  readonly submarineType: string;
  readonly available: number;
}

export interface MinePressure {
  readonly areaId: string;
  readonly density: number;
  readonly sources: readonly unknown[];
  readonly freshness: number;
  readonly detectionConfidence: number;
}

export interface LandTargetDamage {
  readonly landTargetId: string;
  readonly damage: number;
  readonly state: string;
}

export interface ReplayBattleBoundaryResponse {
  readonly matches: boolean;
  readonly expectedHash?: string;
  readonly actualHash?: string;
  readonly diagnostics: readonly string[];
}

// --- Construction commands (real, MVP scope per ticket 10) ---

export type ConstructionCommandStatus = "submitted" | "accepted" | "superseded" | "cancelled";

export interface ConstructionCommand {
  readonly commandId: string;
  readonly designId: string;
  readonly design: CompiledDesignVersion;
  readonly nationId: string;
  readonly status: ConstructionCommandStatus;
  readonly submittedAtRevision: number;
  readonly projectedCost: number;
  readonly projectedCapacityUnits: number;
}
