import type { FleetMark } from "../map-markers.js";
import { pinned } from "../map-svg.js";

export interface FleetsLayerProps {
  readonly marks: readonly FleetMark[];
  readonly strokeFor: (nation: string) => string;
  readonly live: boolean;
  readonly playerNationId: string | null;
}

export function FleetsLayer({ marks, strokeFor, live, playerNationId }: FleetsLayerProps) {
  return (
    <>
      {marks.map((mark) => {
        const grouped = mark.count > 1;
        const half = grouped ? 15 : 11;
        return (
          <g
            key={mark.id}
            style={pinned(mark.ux, mark.uy)}
            opacity={grouped || !live || mark.owner === playerNationId ? 1 : 0.72}
          >
            {grouped && <title>{`${mark.count} fleets · ${mark.ships} ships`}</title>}
            <rect
              x={-half}
              y={-8}
              width={half * 2}
              height={16}
              rx={3}
              fill={mark.owner === null ? "oklch(0.78 0.02 240)" : strokeFor(mark.owner)}
              stroke="oklch(0.15 0.02 245)"
              strokeWidth={grouped ? 2 : 1.4}
            />
            <text
              y={4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="oklch(0.15 0.02 245)"
              style={{ pointerEvents: "none" }}
            >
              {mark.ships}
            </text>
          </g>
        );
      })}
    </>
  );
}
