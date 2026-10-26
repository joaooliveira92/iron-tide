import type { StrategicPriority } from "@bluewave/campaign-engine";
import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { CardShell } from "../../components/shared/CardShell.js";
import { CardTitle } from "../../components/ui/card.js";
import { cn } from "../../lib/utils.js";
import {
  PRIORITY_SEVERITY_STYLE,
  PRIORITY_TYPE_ICON,
  SEVERITY_LABELS,
  destinationLabel,
} from "../../lib/priorities.js";
import type { Screen } from "../../shell/campaign-screen-registry.js";
import type { PrioritiesState } from "./usePriorities.js";
import { Tip } from "../../components/ui/tip.js";

export const MAX_VISIBLE_PRIORITIES = 5;

function PriorityRow({
  priority,
  onNavigate,
}: {
  readonly priority: StrategicPriority;
  readonly onNavigate: (screen: Screen) => void;
}) {
  const style = PRIORITY_SEVERITY_STYLE[priority.severity];
  const Icon = PRIORITY_TYPE_ICON[priority.type];
  const actionable = priority.destination !== "overview";
  const destination = destinationLabel(priority.destination);
  const working = [priority.advice, priority.reason].filter(Boolean).join(" ");

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", style.tile)}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <span className={style.label}>{SEVERITY_LABELS[priority.severity]}</span>
          {actionable && (
            <>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span className="truncate text-muted-foreground">{destination}</span>
            </>
          )}
        </span>
        <span className="text-sm font-semibold leading-tight text-foreground">
          {priority.title}
        </span>
        <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
          {priority.summary}
        </span>
      </span>
      {actionable && (
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      )}
    </>
  );

  const shared = "flex w-full items-start gap-2.5 rounded-lg border p-2 text-left";

  return (
    <li>
      {actionable ? (
        <Tip label={working}>
          <button
            type="button"

            aria-label={`${priority.title}. ${priority.summary} Go to ${destination}`}
            onClick={() => onNavigate(priority.destination)}
            className={cn(
              shared,
              "group cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              style.row,
            )}
          >
            {body}
          </button>
        </Tip>
      ) : (
        <div title={working} className={cn(shared, style.rowStatic)}>
          {body}
        </div>
      )}
    </li>
  );
}

export function PrioritiesCard({
  state,
  onNavigate,
  embedded = false,
}: {
  readonly state: PrioritiesState;
  readonly onNavigate: (screen: Screen) => void;
  readonly embedded?: boolean;
}) {
  const priorities = state.status === "ready" ? state.priorities : [];
  const hidden = Math.max(0, priorities.length - MAX_VISIBLE_PRIORITIES);
  return (
    <CardShell
      testId="priorities-card"
      embedded={embedded}
      header={
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Immediate Priorities
        </CardTitle>
      }
      contentClassName="space-y-2 text-xs"
    >
      {state.status === "loading" ? (
        <p className="text-muted-foreground">Reading the Admiralty&apos;s concerns…</p>
      ) : state.status === "unavailable" ? (
        <p className="text-muted-foreground" role="alert">
          Priorities are unavailable right now.
        </p>
      ) : priorities.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2 text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
          The Admiralty has identified no urgent concerns.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {priorities.slice(0, MAX_VISIBLE_PRIORITIES).map((priority) => (
              <PriorityRow key={priority.id} priority={priority} onNavigate={onNavigate} />
            ))}
          </ul>
          {hidden > 0 && (
            <p className="px-1 text-muted-foreground">
              and {hidden} more {hidden === 1 ? "concern" : "concerns"}
            </p>
          )}
        </>
      )}
    </CardShell>
  );
}
