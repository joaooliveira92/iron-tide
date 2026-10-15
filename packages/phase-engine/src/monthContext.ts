// packages/phase-engine/src/monthContext.ts
// Shared types + runtime state for the month phase pipeline. The MonthExecutor
// orchestrator and each phase module communicate through `MonthContext` so phase
// bodies never need a reference to the executor.
import type { CampaignSnapshot } from "@bluewave/campaign";
import type { ClimateProfile } from "@bluewave/combat";
import type {
  CommandBody,
  CommandEnvelope,
  CommandLedger,
  CommandLifecycle,
} from "@bluewave/commands";
import type { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import type { EventLedger } from "@bluewave/events";
import type { RandomLedger } from "@bluewave/random";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import type { FinancialLedger } from "./financial-ledger.js";
import type { PhaseGuard } from "./phase-guard.js";
import type { PhaseDefinition } from "./registry.js";

export interface MonthResult {
  finalSnapshot: CampaignSnapshot;
  commandLedger: CommandLedger;
  eventLedger: EventLedger;
  randomLedger: RandomLedger;
  financialLedger: FinancialLedger;
  success: boolean;
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
  readonly nextSeq: () => SafeInt;
}
