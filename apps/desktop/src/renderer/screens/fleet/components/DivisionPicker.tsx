import { memo } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { CardContent } from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group.js";
import type { DivisionPickerRow } from "../fleet-screen-state.js";

export interface DivisionPickerProps {
  readonly rows: readonly DivisionPickerRow[];
  readonly selectedDivisionId: string | null;
  readonly onSelectDivision: (divisionId: string) => void;
}

export const DivisionPicker = memo(function DivisionPicker({
  rows,
  selectedDivisionId,
  onSelectDivision,
}: DivisionPickerProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium">Divisions</h3>
        <Badge variant="secondary" className="text-xs">
          {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <Empty>
          <EmptyIcon />
          <EmptyTitle>No player division</EmptyTitle>
          <EmptyDescription>This campaign has no player division.</EmptyDescription>
        </Empty>
      ) : (
        <RadioGroup
          value={selectedDivisionId}
          onValueChange={(value) => onSelectDivision(value as string)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {rows.map((row) => (
            <RadioGroupItem key={row.divisionId} value={row.divisionId}>
              <CardContent className="p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.fleetName}</p>
                  <p className="text-xs text-muted-foreground">{row.areaName}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.ships.slice(0, 4).map((ship) => (
                      <span
                        key={ship.name}
                        className="inline-flex items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 text-xs text-accent-foreground"
                      >
                        {ship.name}
                        {/* S-1: the ship's readiness state, so the fleet screen shows it. */}
                        <span className="text-[0.65rem] text-muted-foreground">{ship.status}</span>
                      </span>
                    ))}
                    {row.ships.length > 4 && (
                      <span className="inline-block rounded-sm bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                        +{row.ships.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      )}
    </section>
  );
});
