import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { CHART_NODE_HEIGHT, CHART_NODE_WIDTH } from "../research-chart-layout.js";
import { monthsPhrase } from "../research-calendar.js";
import type { ResearchTechView } from "../research-view-model.js";
import { TechnologyDetail } from "./TechnologyDetail.js";
import { TECH_STATUS } from "./tech-status.js";

export interface TechnologyNodeProps {
  readonly tech: ResearchTechView;
  readonly fieldLabel: string;
  readonly x: number;
  readonly y: number;
  readonly dimmed: boolean;
  readonly selected: boolean;
  readonly onHover: (techId: string | null) => void;
  readonly onSelect: (techId: string) => void;
}

function chipFor(tech: ResearchTechView): string {
  switch (tech.status) {
    case "discovered":
      return "Done";
    case "researching":
      return tech.etaMonths === null
        ? "Unfunded"
        : tech.etaMonths === 0
          ? "Next turn"
          : `~${monthsPhrase(tech.etaMonths)}`;
    case "open":
      return tech.oddsPct === null ? "Queued" : `${tech.oddsPct}% next`;
    case "locked":
      return `Needs ${tech.missingPrerequisites.length}`;
    case "future":
      return tech.availabilityLabel ?? "Later";
  }
}

export function TechnologyNode({
  tech,
  fieldLabel,
  x,
  y,
  dimmed,
  selected,
  onHover,
  onSelect,
}: TechnologyNodeProps) {
  const status = TECH_STATUS[tech.status];
  const Icon = status.icon;
  const showProgress = tech.status === "researching" || tech.investedPoints > 0;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={80}
        render={
          <button
            type="button"
            data-testid={`tech-node-${tech.techId}`}
            data-status={tech.status}
            aria-pressed={selected}
            aria-label={`${tech.label}, ${status.label}, ${chipFor(tech)}`}
            onMouseEnter={() => onHover(tech.techId)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(tech.techId)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(tech.techId)}
            style={{ left: x, top: y, width: CHART_NODE_WIDTH, height: CHART_NODE_HEIGHT }}
            className={cn(
              "absolute flex flex-col justify-between rounded-lg border p-2.5 text-left outline-none",
              "transition-[opacity,box-shadow,border-color,transform] duration-200 motion-reduce:transition-none",
              "hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
              status.node,
              dimmed && "opacity-25",
              selected && "ring-2 ring-ring",
            )}
          />
        }
      >
        <span className="flex items-start gap-1.5">
          <Icon aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0", status.iconTone)} />
          <span className="line-clamp-2 text-[0.8125rem] leading-tight font-medium">
            {tech.label}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{tech.cost} pts</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-px tabular-nums",
              tech.status === "researching" && "bg-primary/15 font-medium text-primary",
              tech.status === "open" && tech.oddsPct !== null && "bg-muted text-foreground",
            )}
          >
            {chipFor(tech)}
          </span>
        </span>
        {showProgress && (
          <span
            aria-hidden="true"
            className="absolute inset-x-2.5 bottom-1.5 h-0.5 rounded-full bg-muted"
          >
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${tech.progressPct}%` }}
            />
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={10} className="w-72 p-3">
        <TechnologyDetail tech={tech} fieldLabel={fieldLabel} />
      </HoverCardContent>
    </HoverCard>
  );
}
