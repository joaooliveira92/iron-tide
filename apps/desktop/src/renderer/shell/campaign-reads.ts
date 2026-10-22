import type { PlayerProjection, StrategicPriority } from "@bluewave/campaign-engine";

import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  CampaignCommandClient,
  MonthlyReportEntry,
} from "../../shared/campaign-command-contract.js";
import { countActiveAlerts } from "../lib/priorities.js";
import type { StatusStripAreas } from "./status-strip-state.js";

const TRANSPORT_FAILURE_MESSAGE = "The request failed.";

export type CampaignReadResult<T> =
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * The campaign views every readout needs, fetched once per open/refresh. A
 * failed optional view degrades on its own; only the projection is required to
 * render the shell.
 */
export interface CampaignReads {
  readonly projection: CampaignReadResult<PlayerProjection>;
  readonly areas: CampaignReadResult<StatusStripAreas>;
  readonly reports: CampaignReadResult<readonly MonthlyReportEntry[]>;
  readonly priorities: CampaignReadResult<readonly StrategicPriority[]>;
}

function fold<T>(result: BridgeResult<T>): CampaignReadResult<T> {
  return result.outcome === "success"
    ? { status: "ready", value: result.value }
    : { status: "unavailable", reason: result.reason };
}

async function read<T>(run: () => Promise<BridgeResult<T>>): Promise<CampaignReadResult<T>> {
  try {
    return fold(await run());
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : TRANSPORT_FAILURE_MESSAGE,
    };
  }
}

function view<T, Value>(
  result: CampaignReadResult<T>,
  select: (value: T) => Value,
): CampaignReadResult<Value> {
  return result.status === "ready" ? { status: "ready", value: select(result.value) } : result;
}

export async function readCampaign(
  client: CampaignCommandClient,
  sessionId: string,
): Promise<CampaignReads> {
  const [campaign, map, reports, priorities] = await Promise.all([
    read(() => client.execute("inspectCampaign", sessionId)),
    read(() => client.execute("inspectMap", sessionId)),
    read(() => client.execute("readMonthlyReports", sessionId)),
    read(() => client.execute("inspectPriorities", sessionId)),
  ]);
  return {
    projection: view(campaign, (value) => value.projection),
    areas: view(map, (value) => value.strategic?.world?.areas ?? []),
    reports: view(reports, (value) => value.reports ?? []),
    priorities: view(priorities, (value) => value.priorities),
  };
}

/** Warnings and criticals from the same priorities read the strip shows. */
export function activeAlertsCount(reads: CampaignReads): number | null {
  if (reads.priorities.status !== "ready") return null;
  return Array.isArray(reads.priorities.value) ? countActiveAlerts(reads.priorities.value) : null;
}
