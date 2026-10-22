import type { DesignRequirement } from "@bluewave/ship-design";
import { Target } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card.js";
import { cn } from "../../lib/utils.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

/** The design brief as a compact chip; opening it shows every requirement the design is judged against. */
export function RequirementChip({
  requirement: r,
  className,
}: {
  readonly requirement: DesignRequirement;
  readonly className?: string;
}) {
  const format = usePresentationFormat();
  const speed = (milli: number) =>
    `${format.number(milli / 1000, { maximumFractionDigits: 1 })} kn`;
  const range = (nm: number) => `${format.number(nm)} nm`;
  const rows: [string, string][] = [
    ["Class", r.category],
    ["Top speed", speed(r.requiredSpeedMilliKnots)],
    ["Cruising speed", speed(r.cruiseSpeedMilliKnots)],
    ["Range", range(r.requiredRangeNm)],
    ["Designed against", words(r.designThreatId)],
    ["Expected modernisation", words(r.modernizationExpectation)],
    ["Crew quality", format.percent(r.crewQualityBp, 0)],
    ["Accommodation", words(r.accommodationStandard)],
    ["Protection goal", words(r.protectionGoal ?? "STANDARD")],
  ];
  const summary = `${r.category} · ${speed(r.requiredSpeedMilliKnots)} · ${range(r.requiredRangeNm)}`;
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
