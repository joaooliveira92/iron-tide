import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Skeleton } from "../../../components/ui/skeleton.js";
import { useWorldMapController } from "../../../components/world-map/useWorldMapController.js";
import { fixtureAreaId, nationHomeArea } from "../../../content/presentationContent.js";

const MapSurface = lazy(() =>
  import("../../../components/globe-adapter/MapSurface.js").then((module) => ({
    default: module.MapSurface,
  })),
);

export interface FleetMapProps {
  readonly sessionId: string;
  readonly playerNationId: string;
  readonly focusAreaId: string | null;
  readonly variant: "command" | "panel";
  readonly leftPanels?: ReactNode;
  readonly rightPanels?: ReactNode;
}

export function FleetMap({
  sessionId,
  playerNationId,
  focusAreaId,
  variant,
  leftPanels,
  rightPanels,
}: FleetMapProps) {
  const map = useWorldMapController(sessionId);
  const { onSelect } = map;

  useEffect(() => {
    if (focusAreaId === null) return;
    const fixture = fixtureAreaId(focusAreaId);
    if (fixture !== null) onSelect(fixture);
  }, [focusAreaId, onSelect]);

  return (
    <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
      <MapSurface
        enableGlobe
        className="h-full"
        variant={variant}
        showMinimap={false}
        treeDefaultOpen={false}
        initialFocusAreaId={focusAreaId ?? nationHomeArea(playerNationId)}
        initialFocusNationId={playerNationId}
        leftPanels={leftPanels}
        rightPanels={rightPanels}
        {...map}
      />
    </Suspense>
  );
}
