import type { BattleRecord } from "../diplomacy-hover.js";
import { PLOT_MAX_TENSION, PLOT_RINGS } from "../diplomacy-plot.js";
import { TENSION_TONES } from "../diplomacy-presentation.js";
import { cn } from "../../../lib/utils.js";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import { NationFlag } from "./NationFlag.js";
import { NationHoverCard } from "./NationHoverCard.js";

export interface TensionBandsProps {
  readonly rows: readonly DiplomacyRelationRow[];
  readonly records: ReadonlyMap<string, BattleRecord>;
  readonly selectedId: string | null;
  readonly onSelect: (partnerNationId: string) => void;
}

const COLUMNS = Array.from({ length: PLOT_MAX_TENSION + 1 }, (_, tension) => tension);

export function TensionBands({ rows, records, selectedId, onSelect }: TensionBandsProps) {
  return (
    <div data-testid="tension-bands" className="space-y-1">
      <div className="grid grid-cols-11 gap-1">
        {COLUMNS.map((tension) => {
          const inColumn = rows.filter((row) => row.tension === tension);
          return (
            <ul
              key={tension}
              aria-label={`Tension ${tension}`}
              className="flex min-h-56 flex-col-reverse gap-1 rounded-md bg-muted/40 p-1"
            >
              {inColumn.map((row) => {
                const tone = TENSION_TONES[row.band];
                const selected = row.partnerNationId === selectedId;
                return (
                  <li key={row.partnerNationId}>
                    <NationHoverCard row={row} record={records.get(row.partnerName)} side="top">
                      <button
                        type="button"
                        aria-label={`${row.partnerName}, ${row.relationLabel}, tension ${row.tension} of 10`}
                        aria-pressed={selected}
                        onClick={() => onSelect(row.partnerNationId)}
                        className={cn(
                          "block h-9 w-full overflow-hidden rounded border-2 bg-card outline-none",
                          "transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring",
                          tone.border,
                          selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                          row.atWar && "motion-safe:animate-pulse",
                        )}
                      >
                        <NationFlag
                          url={row.flagUrl}
                          name={row.partnerName}
                          className="size-full"
                        />
                      </button>
                    </NationHoverCard>
                  </li>
                );
              })}
            </ul>
          );
        })}
      </div>
      <div className="grid grid-cols-11 gap-1" aria-hidden="true">
        {COLUMNS.map((tension) => (
          <span key={tension} className="text-center text-xs tabular-nums text-muted-foreground">
            {tension}
          </span>
        ))}
      </div>
      <div className="flex justify-between pt-1 text-xs text-muted-foreground" aria-hidden="true">
        <span>Cordial</span>
        {PLOT_RINGS.map((ring) => (
          <span key={ring.id}>{ring.label}</span>
        ))}
      </div>
    </div>
  );
}
