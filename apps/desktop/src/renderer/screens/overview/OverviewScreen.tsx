import { lazy, Suspense } from "react";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import type { EntityReferenceDto } from "../../../shared/turn-message-contract.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import type { Screen } from "../../shell/campaign-screen-registry.js";
import { DEBUG_MODE } from "../../shell/debug-flag.js";
import {
  OverviewLoadErrorState,
  OverviewLoadingState,
  OverviewHeaderReports,
  OverviewNationsPanel,
} from "./components/index.js";
import { nationHomeArea } from "../../content/presentationContent.js";
import { monthLabel } from "./month-report-format.js";
import { useOverviewModel } from "./hooks/useOverviewModel.js";

function screenForEntity(ref: EntityReferenceDto): Screen | null {
  switch (ref.type) {
    case "ship":
    case "shipClass":
    case "constructionProject":
      return "construction";
    case "technology":
      return "research";
    case "nation":
    case "region":
    case "formation":
    case "battle":
      return "diplomacy";
    default:
      return null;
  }
}

function entityAvailability(projection: PlayerProjection): (ref: EntityReferenceDto) => boolean {
  return (ref) => {
    switch (ref.type) {
      case "technology":
        return projection.knownTechnologyIds.includes(ref.id);
      case "region":
        return projection.strategicAreas.some((area) => area.id === ref.id);
      case "nation":
        return (
          ref.id === projection.playerNationId || projection.knownEnemyNations.includes(ref.id)
        );
      default:
        return true;
    }
  };
}

const MapSurface = lazy(() =>
  import("../../components/globe-adapter/MapSurface.js").then((module) => ({
    default: module.MapSurface,
  })),
);

export interface OverviewScreenProps {
  readonly sessionId: string;
  readonly onNavigate: (screen: Screen) => void;
}

export function OverviewScreen({ sessionId, onNavigate }: OverviewScreenProps) {
  const {
    loadError,
    projection,
    areaName,
    roomy,
    nationRail,
    monthReports,
    turnSummaries,
    turnSummariesLoading,
    turnMessages,
    togglePinned,
    toggleRead,
    map,
    wide,
  } = useOverviewModel(sessionId);

  if (loadError !== null) {
    return <OverviewLoadErrorState message={loadError} />;
  }

  if (projection === null) {
    return <OverviewLoadingState />;
  }

  const homeAreaId = nationHomeArea(projection.playerNationId);

  const headerReports = (
    <OverviewHeaderReports
      reports={monthReports}
      areaName={areaName}
      summaries={turnSummaries}
      summariesLoading={turnSummariesLoading}
      turnMessages={turnMessages}
      onTogglePinned={togglePinned}
      onToggleRead={toggleRead}
      onOpenEntity={(ref) => {
        const screen = screenForEntity(ref);
        if (screen !== null && screen !== "overview") onNavigate(screen);
      }}
      isEntityAvailable={entityAvailability(projection)}
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
        {headerReports}
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <MapSurface
            enableGlobe
            className="h-full"
            variant="command"
            showMinimap={false}
            treeDefaultOpen={false}
            initialFocusAreaId={homeAreaId}
            initialFocusNationId={projection.playerNationId}
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
      {headerReports}
      <div className="h-[60vh] min-h-[22rem]">
        <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
          <MapSurface
            enableGlobe
            className="h-full"
            variant="panel"
            initialFocusAreaId={homeAreaId}
            initialFocusNationId={projection.playerNationId}
            {...map}
          />
        </Suspense>
      </div>
      {nationsPanel}
    </div>
  );
}
