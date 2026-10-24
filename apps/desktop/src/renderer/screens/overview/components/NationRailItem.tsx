import { Ban } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import type { NationRailRow } from "../nation-rail-state.js";
import { NationDetail } from "./NationDetail.js";
import { NationRelationBadge } from "./NationRelationBadge.js";
import { NationSwatch } from "./NationSwatch.js";
import { NationTensionMeter } from "./NationTensionMeter.js";

export function NationRailItem({
  row,
  onOpen,
}: {
  readonly row: NationRailRow;
  readonly onOpen: () => void;
}) {
  return (
    <li>
      <HoverCard>
        <HoverCardTrigger
          delay={120}
          render={<button type="button" />}
          onClick={onOpen}
          aria-label={`${row.name}, ${row.relationLabel}`}
          data-relation={row.relation}
          className={cn(
            "relative flex w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-md border px-2 py-1.5 text-left outline-none transition-colors",
            "bg-muted/40 hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring data-popup-open:bg-muted",
            row.isPlayer && "border-primary/30",
          )}
        >
          <NationSwatch row={row} />
          <span className="relative flex w-full items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white [text-shadow:0_0_2px_#000,0_0_3px_#000,0_1px_2px_#000]">
              {row.name}
            </span>
            {row.blockade && (
              <span role="img" aria-label="Blockade" title="Blockade">
                <Ban className="size-3.5 text-destructive" aria-hidden="true" />
              </span>
            )}
            <NationRelationBadge row={row} iconOnly />
          </span>
          <span className="relative flex w-full items-center gap-2">
            {row.warScore !== null && (
              <span
                className="text-xs font-semibold tabular-nums text-destructive [text-shadow:0_0_2px_#000,0_0_3px_#000,0_1px_2px_#000]"
                aria-label={`War score ${row.warScore.yours} to ${row.warScore.enemy}`}
              >
                {row.warScore.yours}:{row.warScore.enemy}
              </span>
            )}
            {row.tension !== null && <NationTensionMeter tension={row.tension} />}
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="left" className="w-64 overflow-hidden p-0 text-xs leading-snug">
          <NationDetail selected={row} />
        </HoverCardContent>
      </HoverCard>
    </li>
  );
}
