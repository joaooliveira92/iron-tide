import { Check, Plane } from "lucide-react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../components/ui/badge.js";
import { CardContent } from "../../../components/ui/card.js";
import { RadioGroupItem } from "../../../components/ui/radio-group.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { shipTypeIcon } from "../../../components/design-workspace/index.js";

export interface DesignCardProps {
  readonly design: CompiledDesignVersion;
}

/** One selectable approved-design card in the catalog. */
export function DesignCard({ design }: DesignCardProps) {
  const Icon = shipTypeIcon(design.shipType);
  return (
    <RadioGroupItem
      value={design.designId}
      disabled={!design.available}
      className={cn("group relative overflow-hidden", !design.available && "opacity-60")}
    >
      <div
        className="pointer-events-none absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity group-data-checked:opacity-100"
        aria-hidden="true"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </div>
      <CardContent className="space-y-3 p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-data-checked:bg-primary group-data-checked:text-primary-foreground">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="truncate pr-5 font-semibold leading-tight">{design.className}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {design.shipType}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {!design.available && (
            <Badge variant="secondary" className="text-xs">
              Not yet available
            </Badge>
          )}
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {design.year}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {design.mass.toLocaleString()}t
          </Badge>
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {design.speed}kt
          </Badge>
          {design.carrierAttributes !== undefined && (
            <Badge variant="outline" className="gap-1 font-mono text-xs font-normal">
              <Plane className="h-3 w-3" />
              {design.carrierAttributes.aircraftCapacity}
            </Badge>
          )}
        </div>
        {design.requiredTechnologyIds.length > 0 && (
          <HoverCard>
            <HoverCardTrigger render={<span className="inline-flex" />}>
              <Badge variant="secondary" className="text-xs">
                {design.requiredTechnologyIds.length} required tech
                {design.requiredTechnologyIds.length === 1 ? "" : "s"}
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent side="top">
              {design.requiredTechnologyIds.join(", ")}
            </HoverCardContent>
          </HoverCard>
        )}
      </CardContent>
    </RadioGroupItem>
  );
}
