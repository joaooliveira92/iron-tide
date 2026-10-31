import { memo } from "react";
import { Leader } from "../../../components/slate/Slate.js";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group.js";
import type { DivisionPickerRow } from "../fleet-screen-state.js";

export interface DivisionPickerProps {
  readonly rows: readonly DivisionPickerRow[];
  readonly selectedDivisionId: string | null;
  readonly onSelectDivision: (divisionId: string) => void;
}

function shipCount(count: number): string {
  return count === 1 ? "1 ship" : `${count} ships`;
}

export const DivisionPicker = memo(function DivisionPicker({
  rows,
  selectedDivisionId,
  onSelectDivision,
}: DivisionPickerProps) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-admiralty-ink-muted">
        <p className="font-medium text-admiralty-ink">No player division</p>
        <p>This campaign has no player division.</p>
      </div>
    );
  }
  return (
    <RadioGroup
      value={selectedDivisionId}
      onValueChange={(value) => onSelectDivision(value as string)}
      className="gap-0 divide-y divide-admiralty-border"
    >
      {rows.map((row) => {
        const selected = row.divisionId === selectedDivisionId;
        return (
          <RadioGroupItem
            key={row.divisionId}
            value={row.divisionId}
            className="group relative block w-full rounded-none border-0 bg-transparent py-2.5 pl-4 pr-3 text-left text-admiralty-ink hover:bg-admiralty-surface data-checked:bg-admiralty-surface data-checked:ring-0 focus-visible:ring-2 focus-visible:ring-admiralty-signal"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] bg-transparent group-data-checked:bg-admiralty-accent"
            />
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 truncate font-display text-base font-semibold">
                {row.fleetName}
              </span>
              <Leader />
              <span className="shrink-0 text-sm tabular-nums text-admiralty-ink-muted">
                {shipCount(row.ships.length)}
              </span>
            </span>
            <span className="block truncate text-sm text-admiralty-ink-muted">{row.areaName}</span>
            {selected && row.ships.length > 0 && (
              <span className="mt-1.5 block space-y-0.5 border-t border-dotted border-admiralty-ink-faint/60 pt-1.5">
                {row.ships.map((ship) => (
                  <span
                    key={ship.shipId}
                    className="flex items-baseline justify-between gap-3 text-[0.8125rem]"
                  >
                    <span className="truncate">{ship.name}</span>
                    <span className="shrink-0 text-admiralty-ink-muted">{ship.status}</span>
                  </span>
                ))}
              </span>
            )}
          </RadioGroupItem>
        );
      })}
    </RadioGroup>
  );
});
