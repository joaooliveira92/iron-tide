import {
  ARCHETYPE_DIMENSION_MAX,
  ARCHETYPE_DIMENSION_MIN,
  ARCHETYPE_POINT_TOTAL,
  type ArchetypeAllocation,
  type ArchetypeDimension,
} from "@bluewave/campaign-engine";
import { Gauge, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card.js";
import { SlateBody } from "@/components/ui/slate.js";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.js";
import { Progress } from "@/components/ui/progress.js";
import { ARCHETYPE_DIMENSION_DESCRIPTORS } from "../../archetype-dimensions.js";
import { ArchetypeAllocationBar } from "./ArchetypeAllocationBar.js";

export interface ArchetypeAllocationEditorProps {
  readonly allocation: ArchetypeAllocation;
  readonly points: number;
  readonly errors: readonly string[];
  readonly onDimensionChange: (dimension: ArchetypeDimension, value: number) => void;
}

export function ArchetypeAllocationEditor({
  allocation,
  points,
  errors,
  onDimensionChange,
}: ArchetypeAllocationEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <HoverCard>
          <HoverCardTrigger
            render={<span className="flex items-center gap-2 text-sm text-muted-foreground" />}
          >
            <Gauge className="h-4 w-4" />
            Points
          </HoverCardTrigger>
          <HoverCardContent className="w-72">
            <SlateBody>
              <p className="text-xs">
                Each dimension is between {ARCHETYPE_DIMENSION_MIN} and {ARCHETYPE_DIMENSION_MAX};
                the total must equal {ARCHETYPE_POINT_TOTAL}.
              </p>
            </SlateBody>
          </HoverCardContent>
        </HoverCard>
        {errors.length > 0 ? (
          <Popover>
            <PopoverTrigger render={<span className="inline-flex" />} nativeButton={false}>
              <Badge variant="destructive" className="cursor-pointer tabular-nums">
                {points} / {ARCHETYPE_POINT_TOTAL}
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <p className="text-sm font-medium">Allocation needs fixing</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Badge variant="secondary" className="tabular-nums">
            {points} / {ARCHETYPE_POINT_TOTAL}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg border p-2">
        <div className="flex items-center justify-between px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Budget used</span>
          <span className="tabular-nums">
            {points} / {ARCHETYPE_POINT_TOTAL}
          </span>
        </div>
        <Progress value={(points / ARCHETYPE_POINT_TOTAL) * 100} />
      </div>

      <div className="space-y-2">
        {ARCHETYPE_DIMENSION_DESCRIPTORS.map(
          ({ dimension, label, hint, icon: Icon, accentClassName }) => {
            const value = allocation[dimension];
            return (
              <div key={dimension} className="rounded-lg border bg-muted/20 p-2.5">
                <div className="flex items-center justify-between">
                  <label
                    className="flex items-center gap-2 text-sm font-medium"
                    htmlFor={`alloc-${dimension}`}
                  >
                    <Icon className={`h-4 w-4 ${accentClassName}`} />
                    {label}
                  </label>
                  <span className={`text-sm font-semibold tabular-nums ${accentClassName}`}>
                    {value}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 shrink-0 [&_svg]:size-3.5"
                    aria-label={`Decrease ${label}`}
                    disabled={value <= ARCHETYPE_DIMENSION_MIN}
                    onClick={() => onDimensionChange(dimension, value - 1)}
                  >
                    <Minus />
                  </Button>
                  <input
                    id={`alloc-${dimension}`}
                    type="range"
                    min={ARCHETYPE_DIMENSION_MIN}
                    max={ARCHETYPE_DIMENSION_MAX}
                    step={1}
                    value={value}
                    aria-label={`${label} allocation`}
                    onChange={(event) => onDimensionChange(dimension, Number(event.target.value))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 shrink-0 [&_svg]:size-3.5"
                    aria-label={`Increase ${label}`}
                    disabled={value >= ARCHETYPE_DIMENSION_MAX}
                    onClick={() => onDimensionChange(dimension, value + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
              </div>
            );
          },
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Split
        </span>
        <ArchetypeAllocationBar allocation={allocation} />
      </div>
    </div>
  );
}
