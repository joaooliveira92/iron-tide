import type { YardOption } from "@bluewave/ship-design";
import { Badge } from "../../ui/badge.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { yardRows } from "./yardRows.js";

/** Which shipyards could build this design, and why the others cannot. The order is built at the quickest fitting yard. */
export function YardList({ yards }: { readonly yards: readonly YardOption[] }) {
  const format = usePresentationFormat();
  if (yards.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Shipyards</span>
        <HoverCard>
          <HoverCardTrigger render={<span className="inline-flex" />}>
            <Badge variant="outline" className="text-xs">
              chosen automatically
            </Badge>
          </HoverCardTrigger>
          <HoverCardContent side="top">
            An order is built at the quickest yard that can hold the hull, the smallest on a tie.
            The choice is fixed when the design is submitted.
          </HoverCardContent>
        </HoverCard>
      </div>
      <ul className="space-y-1 text-sm" aria-label="Shipyards">
        {yardRows(yards, format).map((row) => (
          <li key={row.yardId} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className={row.tone === "chosen" ? "font-medium" : undefined}>
              {row.name}
              <span className="ml-2 text-xs text-muted-foreground">{row.capacity}</span>
            </span>
            <span
              className={
                row.tone === "blocked"
                  ? "text-muted-foreground"
                  : row.tone === "chosen"
                    ? "text-emerald-600"
                    : undefined
              }
            >
              {row.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
