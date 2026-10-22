import type { PlayerProjection, StrategicPriority } from "@bluewave/campaign-engine";

import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import type { MonthlyReportEntry } from "../../shared/reports-contract.js";
import { readBridge, type BridgeRead } from "../lib/bridge-read.js";
import { countActiveAlerts } from "../lib/priorities.js";
import type { StatusStripAreas } from "./status-strip-state.js";

export type CampaignReadResult<T> = BridgeRead<T>;

export interface CampaignReads {
  readonly projection: CampaignReadResult<PlayerProjection>;
  readonly areas: CampaignReadResult<StatusStripAreas>;
  readonly reports: CampaignReadResult<readonly MonthlyReportEntry[]>;
  readonly priorities: CampaignReadResult<readonly StrategicPriority[]>;
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
    readBridge(client, (c) => c.execute("inspectCampaign", sessionId)),
    readBridge(client, (c) => c.execute("inspectMap", sessionId)),
    readBridge(client, (c) => c.execute("readMonthlyReports", sessionId)),
    readBridge(client, (c) => c.execute("inspectPriorities", sessionId)),
  ]);
  return {
    projection: view(campaign, (value) => value.projection),
    areas: view(map, (value) => value.strategic?.world?.areas ?? []),
    reports: view(reports, (value) => value.reports ?? []),
    priorities: view(priorities, (value) => value.priorities),
  };
}

export function activeAlertsCount(reads: CampaignReads): number | null {
  if (reads.priorities.status !== "ready") return null;
  return Array.isArray(reads.priorities.value) ? countActiveAlerts(reads.priorities.value) : null;
}
