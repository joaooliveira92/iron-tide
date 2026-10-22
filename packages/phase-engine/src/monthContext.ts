import type { CampaignSnapshot } from "@bluewave/campaign";
import type { ClimateProfile } from "@bluewave/combat/weather";
import type { CommandLedger } from "@bluewave/commands";
import type { EventLedger } from "@bluewave/events";
import type { SuspendedTurn } from "@bluewave/messages";
import type { RandomLedger } from "@bluewave/random";
import type { FinancialLedger } from "./financial-ledger.js";

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
