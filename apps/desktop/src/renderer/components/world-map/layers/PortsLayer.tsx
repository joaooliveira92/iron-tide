import { memo } from "react";

import type { PortMark } from "../map-markers.js";
import { pinned } from "../map-svg.js";

export interface PortsLayerProps {
  readonly marks: readonly PortMark[];
  readonly strokeFor: (nation: string) => string;
}

export const PortsLayer = memo(function PortsLayer({ marks, strokeFor }: PortsLayerProps) {
  return (
    <>
      {marks.map((mark) => {
        const grouped = mark.count > 1;
        return (
          <g key={mark.id} style={pinned(mark.ux, mark.uy)}>
            {grouped && <title>{`${mark.count} ports`}</title>}
            <circle
              cx={0}
              cy={0}
              r={grouped ? 9 : mark.major ? 5 : 3.5}
              fill={mark.owner === null ? "oklch(0.78 0.02 240)" : strokeFor(mark.owner)}
              stroke="oklch(0.15 0.02 245)"
              strokeWidth={grouped ? 2 : 1.4}
            />
            {grouped && (
              <text
                y={3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="oklch(0.15 0.02 245)"
                style={{ pointerEvents: "none" }}
              >
                {mark.count}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
});
