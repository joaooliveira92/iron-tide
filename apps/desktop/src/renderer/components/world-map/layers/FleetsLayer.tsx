import { memo } from "react";

import type { FleetMark } from "../map-markers.js";
import { pinned } from "../map-svg.js";

export interface FleetsLayerProps {
  readonly marks: readonly FleetMark[];
  readonly strokeFor: (nation: string) => string;
  readonly live: boolean;
  readonly playerNationId: string | null;
  readonly draggable: ReadonlySet<string>;
  readonly selectedFleetId: string | null;
}

export const FleetsLayer = memo(function FleetsLayer({
  marks,
  strokeFor,
  live,
  playerNationId,
  draggable,
  selectedFleetId,
}: FleetsLayerProps) {
  return (
    <>
      {marks.map((mark) => {
        const grouped = mark.count > 1;
        const half = grouped ? 15 : 11;
        const own = live && !grouped && mark.owner === playerNationId;
        const selected = own && mark.id === selectedFleetId;
        return (
          <g
            key={mark.id}
            style={pinned(mark.ux, mark.uy)}
            opacity={grouped || !live || mark.owner === playerNationId ? 1 : 0.72}
            data-map-fleet={own ? mark.id : undefined}
            data-draggable={own && draggable.has(mark.id) ? "" : undefined}
            className={own && draggable.has(mark.id) ? "cursor-grab" : undefined}
          >
            {grouped && <title>{`${mark.count} fleets · ${mark.ships} ships`}</title>}
            {selected && (
              <rect
                x={-half - 4}
                y={-12}
                width={(half + 4) * 2}
                height={24}
                rx={5}
                fill="none"
                stroke="oklch(0.95 0.12 230)"
                strokeWidth={2}
              />
            )}
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
});
