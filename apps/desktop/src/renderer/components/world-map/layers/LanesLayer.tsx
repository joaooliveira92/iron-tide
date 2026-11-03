import { memo } from "react";

import type { LaneMark } from "../map-lanes.js";

export const LanesLayer = memo(function LanesLayer({
  lanes,
  stroke,
}: {
  readonly lanes: readonly LaneMark[];
  readonly stroke: string;
}) {
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
      {lanes.map((lane) =>
        lane.via !== undefined && lane.via.length > 0 ? (
          <polyline
            key={lane.id}
            points={[lane.from, ...lane.via, lane.to].map(([x, y]) => `${x},${y}`).join(" ")}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            key={lane.id}
            x1={lane.from[0]}
            y1={lane.from[1]}
            x2={lane.to[0]}
            y2={lane.to[1]}
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </g>
  );
});
