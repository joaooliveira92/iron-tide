import { ShieldCheck, Siren } from "lucide-react";

import type { StrategicPriority } from "@bluewave/campaign-engine";

import { cn } from "../../lib/utils.js";
import {
  PRIORITY_SEVERITY_STYLE,
  PRIORITY_TYPE_ICON,
  SEVERITY_LABELS,
  destinationLabel,
} from "../../lib/priorities.js";
import { SlateFacts, SlateHeader } from "../ui/slate.js";
import { severityLevel, sortByUrgency } from "../preTurnReviewModel.js";
import { Dossier, SeverityRuler } from "../ui/dossier.js";

const MAX_SHOWN_WARNINGS = 5;

const STRIPE: Readonly<Record<StrategicPriority["severity"], string>> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  advisory: "bg-muted-foreground/50",
  information: "bg-admiralty-signal/70",
};

function WatchRow({
  priority,
  onOpen,
}: {
  readonly priority: StrategicPriority;
  readonly onOpen: ((priority: StrategicPriority) => void) | undefined;
}) {
  const Icon = PRIORITY_TYPE_ICON[priority.type];
  const style = PRIORITY_SEVERITY_STYLE[priority.severity];
  const actionable = priority.destination !== "overview" && onOpen !== undefined;
  const destination = destinationLabel(priority.destination);
  return (
    <li>
      <Dossier
        side="left"
        tone={priority.severity === "critical" ? "alert" : "normal"}
        icon={<Icon className="size-3" />}
        title={priority.title}
        aside={
          <span className={cn("text-xs font-medium", style.label)}>
            {SEVERITY_LABELS[priority.severity]}
          </span>
        }
        foot={
          actionable
            ? `Select to open ${destination}. The month is not advanced.`
            : "Nothing to open for this one; it is here to inform you."
        }
        triggerProps={{
          className: cn(
            "relative flex w-full items-center gap-3 overflow-hidden rounded-md border py-2 pr-3 pl-4 text-left outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring",
            actionable ? style.row : cn(style.rowStatic, "cursor-default"),
          ),
          "aria-label": `${SEVERITY_LABELS[priority.severity]}: ${priority.title}`,
          onClick: actionable ? () => onOpen(priority) : () => {},
        }}
        trigger={
          <>
            <span
              aria-hidden="true"
              className={cn("absolute inset-y-0 left-0 w-1", STRIPE[priority.severity])}
            />
            <span
              aria-hidden="true"
              className={cn("grid size-7 shrink-0 place-items-center rounded-md", style.tile)}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{priority.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{priority.summary}</span>
            </span>
            {actionable && (
              <span className="shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
                {destination}
              </span>
            )}
          </>
        }
      >
        <div className="space-y-1">
          <SeverityRuler level={severityLevel(priority.severity)} />
          <p className="text-xs text-muted-foreground">
            {SEVERITY_LABELS[priority.severity]}, level {severityLevel(priority.severity)} of 4
          </p>
        </div>
        <div>
          <p className="text-xs font-medium">How the Admiralty worked this out</p>
          <p className="mt-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 font-mono text-[0.6875rem] leading-snug break-words text-muted-foreground">
            {priority.reason}
          </p>
        </div>
        <SlateFacts
          rows={[
            { label: "Raised by", value: priority.title },
            { label: "Settle it in", value: destination },
          ]}
        />
      </Dossier>
    </li>
  );
}

export function WatchList({
  priorities,
  loading,
  onOpen,
}: {
  readonly priorities: readonly StrategicPriority[];
  readonly loading: boolean;
  readonly onOpen: ((priority: StrategicPriority) => void) | undefined;
}) {
  const ordered = sortByUrgency(priorities);
  const shown = ordered.slice(0, MAX_SHOWN_WARNINGS);
  const hidden = ordered.length - shown.length;
  return (
    <section aria-label="Watch-list" className="min-w-0">
      <SlateHeader
        icon={<Siren className="size-3" />}
        title="Watch-list"
        tone={ordered.some((p) => p.severity === "critical") ? "alert" : "normal"}
        aside={
          <span className="text-xs tabular-nums text-muted-foreground">
            {ordered.length === 0 ? "all quiet" : `${String(ordered.length)} open`}
          </span>
        }
      />
      <div className="px-2 py-2">
        {ordered.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-border/70 px-3 py-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-success/15 text-success"
            >
              <ShieldCheck className="size-4" />
            </span>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "The Admiralty is going through the dispatches…"
                : "The Admiralty has identified no urgent concerns."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {shown.map((priority) => (
              <WatchRow key={priority.id} priority={priority} onOpen={onOpen} />
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            and {String(hidden)} more, all less urgent than these
          </p>
        )}
      </div>
    </section>
  );
}
