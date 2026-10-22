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

export const PLAYER_NATION_UNKNOWN = "PLAYER_NATION_UNKNOWN" as const;

export interface MonthResult {
  finalSnapshot: CampaignSnapshot;
  commandLedger: CommandLedger;
  eventLedger: EventLedger;
  randomLedger: RandomLedger;
  financialLedger: FinancialLedger;
  success: boolean;
  outcome?: "completed" | "suspended";
  suspended?: SuspendedTurn;
}

export interface StrategicWeatherPhaseOptions {
  readonly climateProfiles?: ReadonlyMap<string, ClimateProfile>;
}

export interface MonthExecutorEngineOptions {
  readonly phaseOverrides?: ReadonlyMap<string, PhaseDefinition>;
  readonly shipBuilding?: ShipBuildingContent;
  readonly presence?: PresenceMeasurementRules;
  readonly interruptions?: InterruptionChannel;
  readonly playerNationId?: string;
  readonly battleOffers?: BattleOfferRules;
}

export interface MonthContext {
  currentSnapshot: CampaignSnapshot;
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
  readonly interruption?: InterruptionState;
  readonly playerNationId?: string;
  readonly battleOffers?: BattleOfferRules;
  readonly nextSeq: () => SafeInt;
}
