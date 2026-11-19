import { lazy, memo, Suspense } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet.js";
import { useWorldMapController } from "../components/world-map/useWorldMapController.js";
import { useCampaignShellState } from "./CampaignShellContext.js";
import { useHotkeyToggle } from "./useHotkeyToggle.js";

function isMapHotkey(event: KeyboardEvent): boolean {
  if (event.key !== "F1") return false;
  const target = event.target;
  return !(
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

const WorldMapChart = lazy(() =>
  import("../components/world-map/WorldMapChart.js").then((module) => ({
    default: module.WorldMapChart,
  })),
);

export function MapSheet() {
  const { mode } = useCampaignShellState();
  return <MapSheetBody sessionId={mode.kind === "campaign" ? mode.campaign.sessionId : null} />;
}

const MapSheetBody = memo(function MapSheetBody({
  sessionId,
}: {
  readonly sessionId: string | null;
}) {
  const [open, setOpen] = useHotkeyToggle(isMapHotkey);
  const map = useWorldMapController(sessionId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-3 p-4 sm:max-w-none md:w-4/5 lg:w-3/4"
      >
        <SheetHeader className="space-y-0.5 text-left">
          <SheetTitle>World Map</SheetTitle>
        </SheetHeader>
        <Suspense fallback={<div className="min-h-0 flex-1 animate-pulse bg-muted" />}>
          <WorldMapChart className="min-h-0 flex-1" {...map} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
});
