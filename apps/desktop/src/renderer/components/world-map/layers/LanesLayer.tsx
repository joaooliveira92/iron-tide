import type { LaneMark } from "../map-lanes.js";

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
