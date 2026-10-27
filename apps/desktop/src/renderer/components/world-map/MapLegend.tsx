import { CHART } from "./chart-theme.js";

export interface MapLegendProps {
  readonly showPossessions: boolean;
  readonly showFleets: boolean;
  readonly notes?: readonly string[];
}

export function MapLegend({ showPossessions, showFleets, notes = [] }: MapLegendProps) {
  if (!showPossessions && !showFleets && notes.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      className="mb-1.5 flex flex-col gap-1 text-xs"
      style={{ color: CHART.inkDim }}
    >
      {(showPossessions || showFleets) && (
        <div className="flex items-center gap-3">
          {showPossessions && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block size-2.5 rounded-full border"
                style={{ background: CHART.inkDim, borderColor: CHART.ink }}
              />
              Ports
            </span>
          )}
          {showFleets && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-3 rounded-[2px] border"
                style={{ background: CHART.inkDim, borderColor: CHART.ink }}
              />
              Fleets
            </span>
          )}
        </div>
      )}
      {notes.map((note) => (
        <span key={note} className="max-w-[18rem] leading-tight">
          {note}
        </span>
      ))}
    </div>
  );
}
