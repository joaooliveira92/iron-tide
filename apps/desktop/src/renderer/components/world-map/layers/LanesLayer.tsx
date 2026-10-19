import type { LaneMark } from "../map-lanes.js";

/**
 * Passive sea lanes: thin dotted lines between connected areas. Decorative —
 * hidden from assistive tech and transparent to the pointer, so a click always
 * lands on the area underneath. Drawn quieter than a measured route (see
 * `RoutesLayer`), which is solid-cased and amber.
 */
export function LanesLayer({ lanes, stroke }: { lanes: readonly LaneMark[]; stroke: string }) {
  if (lanes.length === 0) return null;
  return (
    <g
      data-layer="lanes"
      aria-hidden="true"
      pointerEvents="none"
      fill="none"
      stroke={stroke}
      strokeWidth={1.4}
      strokeDasharray="1 5"
      strokeLinecap="round"
    >
      {lanes.map((lane) => (
        <line
          key={lane.id}
          x1={lane.from[0]}
          y1={lane.from[1]}
          x2={lane.to[0]}
          y2={lane.to[1]}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
