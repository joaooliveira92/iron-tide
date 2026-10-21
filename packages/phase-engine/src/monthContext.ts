// Shared types + runtime state for the month phase pipeline. The MonthExecutor
// orchestrator and each phase module communicate through `MonthContext` so phase
// bodies never need a reference to the executor.
import type { CampaignSnapshot, PresenceMeasurementRules } from "@bluewave/campaign";
import type { ClimateProfile } from "@bluewave/combat";
import type { BattleOfferRules } from "@bluewave/content-schema";
import type {
  CommandBody,
  CommandEnvelope,
  CommandLedger,
  CommandLifecycle,
} from "@bluewave/commands";
import type { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import type { EventLedger } from "@bluewave/events";
import type { SuspendedTurn } from "@bluewave/messages";
import type { RandomLedger } from "@bluewave/random";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import type { FinancialLedger } from "./financial-ledger.js";
import type { InterruptionChannel, InterruptionState } from "./interruption.js";
import type { PhaseGuard } from "./phase-guard.js";
import type { PhaseDefinition } from "./registry.js";

/** Stable diagnostic code for a supplied player nation the snapshot does not contain. */
export const PLAYER_NATION_UNKNOWN = "PLAYER_NATION_UNKNOWN" as const;

export interface MonthResult {
  finalSnapshot: CampaignSnapshot;
  commandLedger: CommandLedger;
  eventLedger: EventLedger;
  randomLedger: RandomLedger;
  financialLedger: FinancialLedger;
  success: boolean;
  /**
   * Additive outcome. `"completed"` for an uninterrupted month (identical to
   * today); `"suspended"` when the month paused for an interruption. Never
   * repurposes `success` (R-21): a suspended month still reports `success: true`.
   */
  outcome?: "completed" | "suspended";
  /** The pause point when `outcome` is `"suspended"`. */
  suspended?: SuspendedTurn;
}

/**
 * B-6/ADR-0025: per-area climate source for the `weather_generation` phase.
 * The engine default `defaultClimateProfile_v1` is the canonical source until
 * the CONTENT-track supplies region climate-profile YAML (spec §1.3 deferral):
 * when `climateProfiles` is undefined every world area uses
 * `defaultClimateProfile_v1` (never a silent fallback — the default IS the
 * canonical source). When a caller supplies an explicit area->profile map, an
 * area missing from the map fails closed with a WEATHER_PROFILE_INCOMPLETE
 * diagnostic (no area is silently skipped without a record).
 */
export interface StrategicWeatherPhaseOptions {
  readonly climateProfiles?: ReadonlyMap<string, ClimateProfile>;
}

/**
 * Engine-level options. `phaseOverrides` substitutes a phase's registry
 * definition at runtime (used by tests to exercise the fail-closed guard for a
 * specific phase). ADR-0036.
 */
export interface MonthExecutorEngineOptions {
  readonly phaseOverrides?: ReadonlyMap<string, PhaseDefinition>;
  /** Ship-building content used to compile `SubmitDesign` commands (ADR-0066). Without it such commands are skipped with a diagnostic. */
  readonly shipBuilding?: ShipBuildingContent;
  /**
   * The values of the optional S-5 presence ruleset section (ADR-0247), read by the month-end presence step. Absent =
   * dormant: no measurement, no shortfall event. The desktop passes `shipBuilding.presence`.
   */
  readonly presence?: PresenceMeasurementRules;
  /**
   * Optional interruption channel. When present the month may suspend for a
   * mandatory decision or a battle; when absent the pipeline is byte-identical to
   * today. Not a `PhaseResource` — the phase registry/footprints are untouched.
   */
  readonly interruptions?: InterruptionChannel;
  /**
   * The player-controlled nation (the session's player slot), supplied explicitly so no phase reads it ambiently
   * (spec #109 R3). Validated against the snapshot's nations before any phase runs: an unknown id fails the month with
   * `PLAYER_NATION_UNKNOWN`. Absent = today's behaviour; no phase consumes it yet.
   */
  readonly playerNationId?: string;
  /**
   * The values of the optional battle-offer ruleset section (spec #109 R1, ADR-0253). Absent = dormant: no offer is raised
   * and the interruption seam behaves exactly as before. An offer needs this, the player nation and an interruption channel.
   */
  readonly battleOffers?: BattleOfferRules;
}

/**
 * Mutable run state shared by the orchestrator and every phase. `currentSnapshot`
 * is reassigned by phases as they commit; `nextSeq` is the single monotonic event
 * sequence source.
 */
export interface MonthContext {
  currentSnapshot: CampaignSnapshot;
  /**
   * The immutable input snapshot as supplied by the caller. Command validation
   * (`expectedSnapshotHash`) is performed against this, never against the
   * progressively-mutated `currentSnapshot`.
   */
  readonly sourceSnapshot: CampaignSnapshot;
  readonly slots: CampaignSnapshot["slots"];
  readonly commands: CommandEnvelope<CommandBody>[];
  readonly campaignMonth: string;
  readonly turnNumber: SafeInt;
  readonly randomSeed: string;
  readonly commandLedger: CommandLedger;
  readonly eventLedger: EventLedger;
  readonly randomLedger: RandomLedger;
  readonly financialLedger: FinancialLedger;
  readonly phaseGuard: PhaseGuard;
  readonly lifecycle: CommandLifecycle;
  readonly collector: DiagnosticCollector;
  readonly options?: StrategicWeatherPhaseOptions;
  readonly engineOptions?: MonthExecutorEngineOptions;
  /** Mutable interruption state; present only when a channel was supplied. */
  readonly interruption?: InterruptionState;
  /** The validated player nation, when supplied. */
  readonly playerNationId?: string;
  /** The battle-offer ruleset section, when the pack authors one. */
  readonly battleOffers?: BattleOfferRules;
  readonly nextSeq: () => SafeInt;
}
