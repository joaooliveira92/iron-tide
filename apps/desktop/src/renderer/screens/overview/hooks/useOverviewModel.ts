import type { PlayerProjection } from "@bluewave/campaign-engine";
import type { MonthlyReportEntry } from "../../../../shared/reports-contract.js";
import type { TurnSummaryEntry } from "../../../../shared/turn-message-contract.js";
import type { UiStateTurnMessages } from "../../../../shared/ui-state-contract.js";
import type { WorldMapController } from "../../../components/world-map/useWorldMapController.js";
import { useWorldMapController } from "../../../components/world-map/useWorldMapController.js";
import { humanizeId } from "../../../lib/humanize-id.js";
import { useCampaignProjection } from "../../../lib/use-campaign-projection.js";
import { useMinWidth } from "../../../lib/use-min-width.js";
import { useDensity } from "../../../shell/DensityContext.js";
import { useMonthlyReports } from "../useMonthlyReports.js";
import { useTurnMessageState } from "../useTurnMessageState.js";
import { useTurnSummaries } from "../useTurnSummaries.js";
import { useNationRail, type NationRailLoad } from "../useNationRail.js";
import { usePriorities, type PrioritiesState } from "../usePriorities.js";

export const COMMAND_OVERLAY_MIN_WIDTH = 1024;

export interface OverviewModel {
  readonly loadError: string | null;
  readonly projection: PlayerProjection | null;
  readonly areaName: (id: string) => string;
  readonly roomy: boolean;
  readonly priorityCount: number | null;
  readonly priorities: PrioritiesState;
  readonly nationRail: NationRailLoad;
  readonly monthReports: readonly MonthlyReportEntry[];
  readonly turnSummaries: readonly TurnSummaryEntry[];
  readonly turnSummariesLoading: boolean;
  readonly turnMessages: UiStateTurnMessages;
  readonly togglePinned: (id: string) => void;
  readonly toggleRead: (id: string) => void;
  readonly map: WorldMapController;
  readonly wide: boolean;
}

export function useOverviewModel(sessionId: string): OverviewModel {
  const priorities = usePriorities(sessionId);
  const nationRail = useNationRail(sessionId);
  const monthReports = useMonthlyReports(sessionId);
  const turnSummaries = useTurnSummaries(sessionId);
  const turnMessageState = useTurnMessageState(sessionId);
  const map = useWorldMapController(sessionId);
  const { density } = useDensity();
  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const { projection, loadError } = useCampaignProjection(sessionId);

  const areaNames = new Map(
    (projection?.strategicAreas ?? []).map((area) => [area.id, area.name] as const),
  );
  const areaName = (id: string): string => areaNames.get(id) ?? humanizeId(id);

  return {
    loadError,
    projection,
    areaName,
    roomy: density !== "compact",
    priorityCount: priorities.status === "ready" ? priorities.priorities.length : null,
    priorities,
    nationRail,
    monthReports: monthReports.reports,
    turnSummaries: turnSummaries.summaries,
    turnSummariesLoading: turnSummaries.loading,
    turnMessages: turnMessageState.turnMessages,
    togglePinned: turnMessageState.togglePinned,
    toggleRead: turnMessageState.toggleRead,
    map,
    wide,
  };
}
