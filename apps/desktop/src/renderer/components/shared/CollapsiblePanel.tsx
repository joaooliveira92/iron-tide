import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { readPanelOpen, writePanelOpen } from "./panel-memory.js";

export interface CollapsiblePanelProps {
  /** Stable id: the open/closed choice is remembered under it for the session. */
  readonly panelId: string;
  readonly title: string;
  /** Used until the player has chosen; compact density passes false. */
  readonly defaultOpen: boolean;
  readonly children: ReactNode;
  /** Short text beside the title that stays visible when collapsed (e.g. a count). */
  readonly badge?: ReactNode;
  readonly className?: string;
  readonly testId?: string;
}

/**
 * A map-overlay panel with a title bar that collapses its body. Uses theme surface colours so the embedded cards' muted/destructive text stays legible.
 * The wrapper takes pointer events itself, so a parent dock can be `pointer-events-none` and let the
 * map underneath keep panning and zooming. The body stays mounted when collapsed (just hidden), so
 * panels keep their selection and their data.
 */
export function CollapsiblePanel({
  panelId,
  title,
  defaultOpen,
  children,
  badge,
  className,
  testId,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(() => readPanelOpen(panelId, defaultOpen));
  const bodyId = useId();
  const Chevron = open ? ChevronDown : ChevronRight;

  function toggle(): void {
    writePanelOpen(panelId, !open);
    setOpen(!open);
  }

  return (
    <section
      data-testid={testId}
      className={cn(
        "pointer-events-auto rounded-lg border text-xs shadow-lg backdrop-blur",
        "border-border bg-background/90 text-foreground",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wide hover:bg-accent"
      >
        <Chevron aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge !== undefined && <span className="font-normal normal-case opacity-75">{badge}</span>}
      </button>
      <div id={bodyId} hidden={!open} className="max-h-[50vh] overflow-y-auto px-2.5 pb-2.5">
        {children}
      </div>
    </section>
  );
}
