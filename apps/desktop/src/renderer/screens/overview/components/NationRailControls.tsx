import { ArrowDownWideNarrow, Flame, Globe, Handshake, Swords } from "lucide-react";
import type { ComponentType } from "react";

import { Toggle } from "../../../components/ui/toggle.js";
import type { NationRailFilter, NationRailSort, NationRailSummary } from "../nation-rail-view.js";
import { IconTip } from "./IconTip.js";

const CHIPS: readonly {
  readonly id: NationRailFilter;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly count: (summary: NationRailSummary, total: number) => number;
}[] = [
  { id: "all", label: "All nations", icon: Globe, count: (_summary, total) => total },
  { id: "war", label: "At war", icon: Swords, count: (summary) => summary.war },
  { id: "allied", label: "Allied", icon: Handshake, count: (summary) => summary.allied },
  { id: "tense", label: "Rising tension", icon: Flame, count: (summary) => summary.tense },
];

const CONTROL = "h-5 min-w-0 gap-1 px-1.5 text-xs";

export function NationRailControls({
  filter,
  onFilter,
  sort,
  onSort,
  summary,
  total,
}: {
  readonly filter: NationRailFilter;
  readonly onFilter: (filter: NationRailFilter) => void;
  readonly sort: NationRailSort;
  readonly onSort: (sort: NationRailSort) => void;
  readonly summary: NationRailSummary;
  readonly total: number;
}) {
  return (
    <div className="flex items-center gap-1" data-testid="nation-rail-controls">
      <div
        role="group"
        aria-label="Filter nations"
        className="flex min-w-0 flex-1 items-center gap-1"
      >
        {CHIPS.map((chip) => {
          const count = chip.count(summary, total);
          const Icon = chip.icon;
          return (
            <IconTip key={chip.id} label={`${chip.label}: ${String(count)}`}>
              <Toggle
                variant="outline"
                size="sm"
                pressed={filter === chip.id}
                onPressedChange={() => {
                  onFilter(chip.id);
                }}
                aria-label={`${chip.label}, ${String(count)}`}
                className={CONTROL}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="tabular-nums">{count}</span>
              </Toggle>
            </IconTip>
          );
        })}
      </div>
      <IconTip label="Sort by tension">
        <Toggle
          variant="outline"
          size="sm"
          pressed={sort === "tension"}
          onPressedChange={(pressed) => {
            onSort(pressed ? "tension" : "name");
          }}
          aria-label="Sort by tension"
          className={`${CONTROL} shrink-0`}
        >
          <ArrowDownWideNarrow className="size-3.5" aria-hidden="true" />
        </Toggle>
      </IconTip>
    </div>
  );
}
