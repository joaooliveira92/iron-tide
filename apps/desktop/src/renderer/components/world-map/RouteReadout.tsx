import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { CHART } from "./chart-theme.js";
import type { RouteReading } from "./map-state.js";

export interface RouteReadoutProps {
  readonly className: string;
  readonly route: RouteReading | null;
}

export function RouteReadout({ className, route }: RouteReadoutProps) {
  const format = usePresentationFormat();
  if (route === null) return null;
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
      <div className="flex items-center gap-4">
        <span>
          <strong className="tabular-nums">{format.count(route.hops)}</strong> hops
        </span>
        <span className="tabular-nums" style={{ color: CHART.inkDim }}>
          {format.count(route.nauticalMiles)} nm
        </span>
        <span className="tabular-nums" style={{ color: CHART.inkDim }}>
          {format.count(route.perHop)} nm/hop
        </span>
        <span className="tabular-nums" style={{ color: CHART.inkDim }}>
          ≈{format.number(route.months, { maximumFractionDigits: 1 })} months
        </span>
      </div>
    </div>
  );
}
