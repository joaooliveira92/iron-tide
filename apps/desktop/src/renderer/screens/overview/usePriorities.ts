import type { StrategicPriority } from "@bluewave/campaign-engine";

import { useRead } from "../../lib/use-read.js";
import { useCampaignRevision } from "../../shell/CampaignShellContext.js";

export type PrioritiesState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly priorities: readonly StrategicPriority[] }
  | { readonly status: "unavailable" };

export function usePriorities(sessionId: string): PrioritiesState {
  const read = useRead("inspectPriorities", sessionId, useCampaignRevision());

  if (read.status === "ready") return { status: "ready", priorities: read.value.priorities };
  if (read.status === "unavailable") return { status: "unavailable" };
  return { status: "loading" };
}
