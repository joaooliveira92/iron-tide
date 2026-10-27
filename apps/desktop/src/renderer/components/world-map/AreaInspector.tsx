import { CHART } from "./chart-theme.js";
import type { AreaSummary } from "./map-state.js";

export interface AreaInspectorProps {
  readonly className: string;
  readonly summary: AreaSummary | null;
  readonly nameFor: (nation: string | null) => string;
  readonly onSelect: (area: string | null) => void;
}

export function AreaInspector({ className, summary, nameFor, onSelect }: AreaInspectorProps) {
  return (
    <div
      data-map-obstacle
      className={className}
      style={{
        background: "oklch(0.16 0.025 245 / 0.9)",
        borderColor: "oklch(0.4 0.02 245)",
        color: CHART.ink,
      }}
    >
      {summary === null ? (
        <p style={{ color: CHART.inkDim }}>
          Click an area to inspect. Shift-click two areas to lay the ruler.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium tracking-wide uppercase">{summary.name}</span>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="leading-none opacity-70 transition-opacity hover:opacity-100"
              style={{ color: CHART.inkDim }}
              aria-label="Clear selection"
            >
              ×
            </button>
          </div>
          <div style={{ color: CHART.inkDim }}>
            {nameFor(summary.control.owner)}
            {summary.control.contested ? " · contested" : ""} · {summary.possessions.length}{" "}
            possessions · {summary.fleets.length} fleets
          </div>
          {summary.fleets.length > 0 && (
            <ul className="m-0 list-none p-0">
              {summary.fleets.map((fleet) => (
                <li key={fleet.id} className="flex justify-between">
                  <span>{fleet.name}</span>
                  <span className="tabular-nums" style={{ color: CHART.inkDim }}>
                    {fleet.ships}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div style={{ color: CHART.inkDim }}>Adjacent</div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {summary.neighbours.map((neighbour) => (
              <li key={neighbour.id}>
                <button
                  type="button"
                  className="w-full text-left transition-opacity hover:opacity-80"
                  onClick={() => onSelect(neighbour.id)}
                >
                  {neighbour.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
