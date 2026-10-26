import type { StrategicPriority } from "@bluewave/campaign-engine";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useState } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import {
  PRIORITY_SEVERITY_STYLE,
  PRIORITY_TYPE_ICON,
  SEVERITY_LABELS,
  destinationLabel,
} from "../../../lib/priorities.js";
import { translate } from "../../../lib/strings.js";
import { cn } from "../../../lib/utils.js";
import { SlateBody, SlateFoot, SlateHeader } from "../../../components/ui/slate.js";
import { PrioritiesCard } from "../../../screens/overview/PrioritiesCard.js";
import type { PrioritiesState } from "../../../screens/overview/usePriorities.js";
import type { Screen } from "../../campaign-screen-registry.js";
import { NO_DRAG } from "../drag-region.js";

export const BRIEFING_VISIBLE_CHIPS = 2;

export interface PriorityBriefingProps {
  readonly state: PrioritiesState;
  readonly onNavigate: (screen: Screen) => void;
}

function PriorityChip({
  priority,
  onNavigate,
}: {
  readonly priority: StrategicPriority;
  readonly onNavigate: (screen: Screen) => void;
}) {
  const style = PRIORITY_SEVERITY_STYLE[priority.severity];
  const Icon = PRIORITY_TYPE_ICON[priority.type];
  const destination = destinationLabel(priority.destination);

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        onClick={() => onNavigate(priority.destination)}
        aria-label={`${SEVERITY_LABELS[priority.severity]}: ${priority.title}. Go to ${destination}`}
        data-severity={priority.severity}
        className={cn(
          "flex h-7 min-w-0 max-w-64 shrink cursor-pointer items-center gap-1.5 rounded-md border pr-2 pl-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          style.row,
        )}
      >
        <span
          aria-hidden="true"
          className={cn("flex size-5 shrink-0 items-center justify-center rounded", style.tile)}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="truncate font-medium text-foreground">{priority.title}</span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 text-xs leading-snug">
        <SlateHeader
          title={priority.title}
          tone={priority.severity === "critical" ? "alert" : "normal"}
          aside={
            <span className={cn("text-xs font-semibold uppercase tracking-wide", style.label)}>
              {SEVERITY_LABELS[priority.severity]}
            </span>
          }
        />
        <SlateBody>
          <p className="text-muted-foreground">{priority.summary}</p>
          <p className="text-xs font-medium text-foreground">{destination}</p>
        </SlateBody>
        <SlateFoot>{priority.reason}</SlateFoot>
      </HoverCardContent>
    </HoverCard>
  );
}

function MorePriorities({
  state,
  hidden,
  onNavigate,
}: {
  readonly state: PrioritiesState;
  readonly hidden: number;
  readonly onNavigate: (screen: Screen) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border bg-muted/40 px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        {translate("shell.header.briefing.more", { count: hidden })}
        <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {translate("shell.header.briefing.title")}
        </p>
        <PrioritiesCard
          state={state}
          embedded
          onNavigate={(screen) => {
            setOpen(false);
            onNavigate(screen);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function PriorityBriefing({ state, onNavigate }: PriorityBriefingProps) {
  if (state.status !== "ready") return null;
  const { priorities } = state;

  if (priorities.length === 0) {
    return (
      <span
        data-testid="priority-briefing"
        className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <ShieldCheck aria-hidden="true" className="size-3.5 text-success" />
        {translate("shell.header.briefing.clear")}
      </span>
    );
  }

  const visible = priorities.slice(0, BRIEFING_VISIBLE_CHIPS);
  const hidden = priorities.length - visible.length;

  return (
    <div
      data-testid="priority-briefing"
      role="group"
      aria-label={translate("shell.header.briefing.title")}
      className="flex min-w-0 items-center gap-1.5"
      style={NO_DRAG}
    >
      {visible.map((priority) => (
        <PriorityChip key={priority.id} priority={priority} onNavigate={onNavigate} />
      ))}
      {hidden > 0 && <MorePriorities state={state} hidden={hidden} onNavigate={onNavigate} />}
    </div>
  );
}
