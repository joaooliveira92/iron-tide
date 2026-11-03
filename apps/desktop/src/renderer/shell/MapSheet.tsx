import { lazy, Suspense, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet.js";
import { useWorldMapController } from "../components/world-map/useWorldMapController.js";
import { useCampaignShellContext } from "./CampaignShellContext.js";

const WorldMapChart = lazy(() =>
  import("../components/world-map/WorldMapChart.js").then((module) => ({
    default: module.WorldMapChart,
  })),
);

export function MapSheet() {
  const [open, setOpen] = useState(false);
  const { state: shell } = useCampaignShellContext();
  const sessionId = shell.mode.kind === "campaign" ? shell.mode.campaign.sessionId : null;
  const map = useWorldMapController(sessionId);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "F1") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setOpen((isOpen) => !isOpen);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
}
