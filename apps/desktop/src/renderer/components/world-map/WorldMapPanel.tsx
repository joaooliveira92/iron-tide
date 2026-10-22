import { Map as MapIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "../ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import { Skeleton } from "../ui/skeleton.js";
import { fixtureAreaId } from "../../content/presentationContent.js";
import { useWorldMapController } from "./useWorldMapController.js";
import { cn } from "../../lib/utils.js";

const WorldMapChart = lazy(() =>
  import("./WorldMapChart.js").then((module) => ({
    default: module.WorldMapChart,
  })),
);

export const MAP_PANEL_SIZES = [
  { id: "compact", label: "Compact", className: "h-80" },
  { id: "large", label: "Large", className: "h-[34rem]" },
  { id: "fill", label: "Fill", className: "h-[calc(100vh-14rem)] min-h-[28rem]" },
] as const;

export type MapPanelSize = (typeof MAP_PANEL_SIZES)[number]["id"];

export interface WorldMapPanelProps {
  readonly sessionId: string;
  readonly title?: string;
  readonly defaultSize?: MapPanelSize;
  readonly focusAreaId?: string | null;
  readonly testId?: string;
}

export function WorldMapPanel({
  sessionId,
  title = "World map",
  defaultSize = "compact",
  focusAreaId = null,
  testId = "world-map-panel",
}: WorldMapPanelProps) {
  const [size, setSize] = useState<MapPanelSize>(defaultSize);
  const map = useWorldMapController(sessionId);
  const active = MAP_PANEL_SIZES.find((option) => option.id === size) ?? MAP_PANEL_SIZES[0];
  const { onSelect } = map;

  useEffect(() => {
    if (focusAreaId === null) return;
    const fixture = fixtureAreaId(focusAreaId);
    if (fixture !== null) onSelect(fixture);
  }, [focusAreaId, onSelect]);

  return (
    <GlassCard glassVariant="liquid-refract" data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          <MapIcon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            F1 opens a larger map
          </span>
          <div role="group" aria-label="Map size" className="flex gap-1">
            {MAP_PANEL_SIZES.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={option.id === size ? "default" : "outline"}
                aria-pressed={option.id === size}
                onClick={() => setSize(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("transition-[height] duration-200", active.className)}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
            <WorldMapChart
              className="h-full"
              variant="panel"
              showMinimap={size !== "compact"}
              {...map}
            />
          </Suspense>
        </div>
      </CardContent>
    </GlassCard>
  );
}
