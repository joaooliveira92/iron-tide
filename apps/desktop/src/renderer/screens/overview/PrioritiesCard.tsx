import type { StrategicPriority } from "@bluewave/campaign-engine";
import { AlertTriangle } from "lucide-react";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { CardShell } from "../../components/shared/CardShell.js";
import { CardTitle } from "../../components/ui/card.js";
import { SEVERITY_LABELS, SEVERITY_VARIANT, destinationLabel } from "../../lib/priorities.js";
import type { Screen } from "../../shell/campaign-screen-registry.js";
import type { PrioritiesState } from "./usePriorities.js";

/** At most this many priorities are shown; the engine already sorts the most urgent first. */
export const MAX_VISIBLE_PRIORITIES = 5;

function PriorityRow({
  priority,
  onNavigate,
}: {
  readonly priority: StrategicPriority;
  readonly onNavigate: (screen: Screen) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={SEVERITY_VARIANT[priority.severity]}>
            {SEVERITY_LABELS[priority.severity]}
          </Badge>
          <p className="font-medium">{priority.title}</p>
        </div>
        <p className="text-muted-foreground">{priority.summary}</p>
      </div>
      {priority.destination !== "overview" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(priority.destination)}
        >
          Go to {destinationLabel(priority.destination)}
        </Button>
      )}
    </li>
  );
}

/** The engine's strategic priorities, most urgent first, each linking to where it can be acted on. */
export function PrioritiesCard({
  state,
  onNavigate,
  embedded = false,
}: {
  readonly state: PrioritiesState;
  readonly onNavigate: (screen: Screen) => void;
  /** Render only the body (a host panel supplies the chrome and title). */
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
        <p className="text-muted-foreground">The Admiralty has identified no urgent concerns.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {priorities.slice(0, MAX_VISIBLE_PRIORITIES).map((priority) => (
              <PriorityRow key={priority.id} priority={priority} onNavigate={onNavigate} />
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-muted-foreground">
              and {hidden} more {hidden === 1 ? "concern" : "concerns"}
            </p>
          )}
        </>
      )}
    </CardShell>
  );
}
