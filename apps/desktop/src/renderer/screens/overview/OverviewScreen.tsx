import { lazy, Suspense } from "react";
import { Skeleton } from "../../components/ui/skeleton.js";
import type { Screen } from "../../shell/campaign-screen-registry.js";
import { DEBUG_MODE } from "../../shell/debug-flag.js";
import {
  OverviewLoadErrorState,
  OverviewLoadingState,
  OverviewMonthReportPanel,
  OverviewNationsPanel,
  OverviewPrioritiesPanel,
} from "./components/index.js";
import { nationHomeArea } from "../../content/presentationContent.js";
import { monthLabel } from "./month-report-format.js";
import { useOverviewModel } from "./hooks/useOverviewModel.js";

// The map (Canvas renderer + 2 MB coastline) is the heaviest thing on the home screen, so it loads
// lazily and never delays the panels.
const WorldMapChart = lazy(() =>
  import("../../components/world-map/WorldMapChart.js").then((module) => ({
    default: module.WorldMapChart,
  })),
);

export interface OverviewScreenProps {
  readonly sessionId: string;
  readonly onNavigate: (screen: Screen) => void;
}

/**
 * The campaign command screen (CC-1, CC-2): a full-bleed world map with collapsible panels floating
 * at its edges (areas and layers at the left, month report and priorities under them, the nation rail
 * at the right). Budget and nation figures live in the status strip. Under 1024 px the map comes
 * first and the same panels stack beneath it.
 */
export function OverviewScreen({ sessionId, onNavigate }: OverviewScreenProps) {
  const {
    loadError,
    projection,
    areaName,
    roomy,
    priorityCount,
    priorities,
    nationRail,
    monthReports,
    map,
    wide,
  } = useOverviewModel(sessionId);

  if (loadError !== null) {
    return <OverviewLoadErrorState message={loadError} />;
  }

  if (projection === null) {
    return <OverviewLoadingState />;
  }

  // The map opens centred on the player's own waters (their nation's home area).
  const homeAreaId = nationHomeArea(projection.playerNationId);

  const prioritiesPanel = (
    <OverviewPrioritiesPanel
      state={priorities}
      priorityCount={priorityCount}
      defaultOpen={roomy}
      onNavigate={onNavigate}
    />
  );
  const monthReport = (
    <OverviewMonthReportPanel
      reports={monthReports}
      areaName={areaName}
      defaultOpen={roomy && monthReports.length > 0}
    />
  );
  const nationsPanel = (
    <OverviewNationsPanel
      state={nationRail}
      playerName={projection.nationName}
      defaultOpen={roomy}
      onNavigate={onNavigate}
    />
  );

  const heading = (
    <>
      <h1 className="sr-only">
        Campaign Overview, {monthLabel(projection.month)}
        {DEBUG_MODE && ` · Revision ${projection.revision} · Session ${sessionId}`}
      </h1>
      <p className="sr-only">{projection.campaignIdentity}</p>
    </>
  );

  if (wide) {
    return (
      <div data-guided-target="overview" className="relative h-full min-h-[28rem]">
        {heading}
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <WorldMapChart
            className="h-full"
            variant="command"
            showMinimap={false}
            treeDefaultOpen={false}
            initialFocusAreaId={homeAreaId}
            leftPanels={
              <>
                {prioritiesPanel}
                {monthReport}
              </>
            }
            rightPanels={nationsPanel}
            {...map}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div data-guided-target="overview" className="flex flex-col gap-3 p-3">
      {heading}
      <div className="h-[60vh] min-h-[22rem]">
        <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
          <WorldMapChart
            className="h-full"
            variant="panel"
            initialFocusAreaId={homeAreaId}
            {...map}
          />
        </Suspense>
      </div>
      {prioritiesPanel}
      {monthReport}
      {nationsPanel}
    </div>
  );
}
