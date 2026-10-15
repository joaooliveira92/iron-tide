import type { DesignRequirement } from "@bluewave/ship-design";
import { Target } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card.js";
import { cn } from "../../lib/utils.js";

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

/** The design brief as a compact chip; opening it shows every requirement the design is judged against. */
export function RequirementChip({
  requirement: r,
  className,
}: {
  readonly requirement: DesignRequirement;
  readonly className?: string;
}) {
  const rows: [string, string][] = [
    ["Class", r.category],
    ["Top speed", `${(r.requiredSpeedMilliKnots / 1000).toFixed(1)} kn`],
    ["Cruising speed", `${(r.cruiseSpeedMilliKnots / 1000).toFixed(1)} kn`],
    ["Range", `${r.requiredRangeNm.toLocaleString("en-US")} nm`],
    ["Designed against", words(r.designThreatId)],
    ["Expected modernisation", words(r.modernizationExpectation)],
    ["Crew quality", `${(r.crewQualityBp / 100).toFixed(0)}%`],
    ["Accommodation", words(r.accommodationStandard)],
    ["Protection goal", words(r.protectionGoal ?? "STANDARD")],
  ];
  const summary = `${r.category} · ${(r.requiredSpeedMilliKnots / 1000).toFixed(1)} kn · ${r.requiredRangeNm.toLocaleString("en-US")} nm`;
  const trigger = (
    <button
      type="button"
      aria-label={`Design requirement: ${summary}`}
      className={cn(
        "flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
  return (
    <Popover>
      <HoverCard>
        <HoverCardTrigger render={<PopoverTrigger render={trigger} />}>
          <Badge variant="outline" className="h-full cursor-pointer">
            <Target aria-hidden="true" className="size-3" />
          </Badge>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-auto max-w-64 px-3 py-1.5 text-xs">
          {summary}
        </HoverCardContent>
      </HoverCard>
      <PopoverContent aria-label="Design requirement" className="w-72 text-sm">
        <div className="mb-2 font-medium">Design requirement</div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
