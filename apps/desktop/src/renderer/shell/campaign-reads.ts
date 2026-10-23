import type { PlayerProjection, StrategicPriority } from "@bluewave/campaign-engine";

import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import type { MonthlyReportEntry } from "../../shared/reports-contract.js";
import type { BridgeRead } from "../lib/bridge-read.js";
import { countActiveAlerts } from "../lib/priorities.js";
import { primeQuery, readQuery } from "../lib/read-queries.js";
import type { PrioritiesState } from "../screens/overview/usePriorities.js";
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
    readQuery(client, "inspectCampaign", sessionId, null),
    readQuery(client, "inspectMap", sessionId, null),
    readQuery(client, "readMonthlyReports", sessionId, null),
    readQuery(client, "inspectPriorities", sessionId, null),
  ]);
  const revision = campaign.status === "ready" ? campaign.value.projection?.revision : undefined;
  if (campaign.status === "ready" && revision !== undefined) {
    primeQuery(client, "inspectCampaign", sessionId, revision, campaign.value);
    if (map.status === "ready") primeQuery(client, "inspectMap", sessionId, revision, map.value);
    if (reports.status === "ready") {
      primeQuery(client, "readMonthlyReports", sessionId, revision, reports.value);
    }
    if (priorities.status === "ready") {
      primeQuery(client, "inspectPriorities", sessionId, revision, priorities.value);
    }
  }
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

export function prioritiesStateFromReads(reads: CampaignReads): PrioritiesState {
  if (reads.priorities.status === "ready") {
    return { status: "ready", priorities: reads.priorities.value };
  }
  if (reads.priorities.status === "unavailable") return { status: "unavailable" };
  return { status: "loading" };
}
