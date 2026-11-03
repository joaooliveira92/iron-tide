import type { CSSProperties } from "react";
import { CalendarClock, Hammer } from "lucide-react";
import { ScreenStage } from "../../../components/shared/ScreenStage.js";
import { Skeleton } from "../../../components/ui/skeleton.js";
import { debugRevisionActions } from "../../../components/shared/debugRevisionActions.js";
import { INSPECTOR_COLLAPSED_PX } from "../../shipbuilding/inspector-layout.js";
import { cn } from "../../../lib/utils.js";
import { LoadErrorCard, YardRail, YardStatusBar } from "../components/index.js";
import { DeferredConstruction } from "./DeferredConstruction.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { StageOutlet } from "./StageOutlet.js";
import { YardOrdersBar } from "./YardOrdersBar.js";
import {
  useConstructionActions,
  useConstructionMeta,
  useConstructionState,
} from "./ConstructionContext.js";

export function ConstructionLayout() {
  const { screen, loadError } = useConstructionState();
  const { loadScreen, navigate, onKeyDownCapture } = useConstructionActions();
  const { hosted, place, marks, readouts, currentPlace, monthLabel, inspector, reviewing } =
    useConstructionMeta();

  if (loadError !== null) {
    return (
      <div data-guided-target="construction">
        <LoadErrorCard message={loadError} onReload={() => void loadScreen()} />
      </div>
    );
  }

  if (screen.workspace === null || screen.economy === null || marks === null || readouts === null) {
    return (
      <div data-guided-target="construction" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <Skeleton key={idx} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <ScreenStage
      guidedTarget="construction"
      icon={Hammer}
      title="Construction Commands"
      description="Drydock procurement and shipyard queue management."
      actions={
        hosted ? (
          <>
            <YardOrdersBar variant="header" />
            {debugRevisionActions(screen.month, screen.revision)}
          </>
        ) : (
          debugRevisionActions(screen.month, screen.revision)
        )
      }
      className="space-y-3"
    >
      {screen.notice !== null && !reviewing && (
        <p role="status" className="text-sm whitespace-pre-line text-muted-foreground">
          {screen.notice}
        </p>
      )}

      <div
        data-testid="construction-workspace"
        className={cn(
          "grid h-[clamp(30rem,calc(100svh_-_var(--chrome-top,0px)_-_var(--chrome-bottom,0px)_-_3rem),60rem)] min-h-0 overflow-hidden rounded-lg border bg-background",
          hosted ? "grid-rows-[minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)_auto]",
        )}
        onKeyDownCapture={onKeyDownCapture}
      >
        {!hosted && <YardOrdersBar variant="bar" />}

        <div
          data-testid="construction-grid"
          className="grid min-h-0 grid-cols-[3.5rem_minmax(0,1fr)_var(--inspector-width)] xl:grid-cols-[13rem_minmax(0,1fr)_var(--inspector-width)]"
          style={
            {
              "--inspector-width": `${
                inspector.layout.collapsed ? INSPECTOR_COLLAPSED_PX : inspector.layout.widthPx
              }px`,
            } as CSSProperties
          }
        >
          <YardRail
            active={place}
            marks={marks}
            onSelect={navigate}
            footer={
              <p className="mt-1 flex items-center gap-1.5 border-t px-1 pt-2 text-xs text-muted-foreground max-xl:hidden">
                <CalendarClock aria-hidden="true" className="size-4" />
                Month
                <span className="font-medium tabular-nums text-foreground">{monthLabel}</span>
              </p>
            }
          />

          <section aria-label={currentPlace.label} className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="themed-scrollbar min-h-0 flex-1 overflow-auto p-3">
              <StageOutlet />
            </div>
          </section>

          <InspectorPanel />
        </div>

        <YardStatusBar readouts={readouts} />
      </div>

      <DeferredConstruction />
    </ScreenStage>
  );
}
