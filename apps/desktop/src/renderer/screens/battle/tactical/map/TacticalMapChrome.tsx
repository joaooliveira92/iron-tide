import { formatMeasurement } from "../../../../lib/presentation-format/format.js";
import { UM_PER_NAUTICAL_MILE } from "../../../../lib/presentation-format/units.js";
import { TACTICAL_PALETTE } from "../tactical-palette.js";
import { useTacticalMap } from "./tactical-map-context.js";

function ScaleBar() {
  const { viewport, bar, measurement } = useTacticalMap();
  const barText = bar.nm > 0 ? formatMeasurement(bar.nm * UM_PER_NAUTICAL_MILE, measurement) : "";
  return (
    <g pointerEvents="none" transform={`translate(12 ${String(viewport.height - 16)})`}>
      <line x1={0} y1={0} x2={bar.px} y2={0} stroke={TACTICAL_PALETTE.chrome} strokeWidth={2} />
      <line x1={0} y1={-4} x2={0} y2={4} stroke={TACTICAL_PALETTE.chrome} strokeWidth={2} />
      <line
        x1={bar.px}
        y1={-4}
        x2={bar.px}
        y2={4}
        stroke={TACTICAL_PALETTE.chrome}
        strokeWidth={2}
      />
      <text
        x={bar.px + 8}
        y={4}
        fill={TACTICAL_PALETTE.chrome}
        fontSize={12}
        data-testid="tactical-scale"
      >
        {barText}
      </text>
    </g>
  );
}

function Compass() {
  const { viewport } = useTacticalMap();
  return (
    <g
      pointerEvents="none"
      transform={`translate(${String(viewport.width - 28)} 28)`}
      aria-hidden="true"
    >
      <circle r={14} fill="none" stroke={TACTICAL_PALETTE.compassRing} />
      <path d="M0 -12 L4 2 L0 -2 L-4 2 Z" fill={TACTICAL_PALETTE.chrome} />
      <text y={-16} textAnchor="middle" fill={TACTICAL_PALETTE.chrome} fontSize={12}>
        N
      </text>
    </g>
  );
}

export function TacticalMapChrome() {
  return (
    <>
      <ScaleBar />
      <Compass />
    </>
  );
}
