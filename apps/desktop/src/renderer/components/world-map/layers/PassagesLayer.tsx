import { pinned } from "../map-svg.js";
import type { MapPalette } from "../map-palette.js";
import type { PassageMark } from "../useWorldMapModel.js";

/** Passage badges, drawn at the midpoint of the edge they gate. */
export function PassagesLayer({
  marks,
  palette,
}: {
  marks: readonly PassageMark[];
  palette: MapPalette;
}) {
  return (
    <>
      {marks.map((mark) => (
        <g key={mark.id}>
          <line
            x1={mark.from[0]}
            y1={mark.from[1]}
            x2={mark.to[0]}
            y2={mark.to[1]}
            stroke={mark.open ? palette.passageOpenLine : palette.passageClosedLine}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={mark.open ? undefined : "5 4"}
          />
          <g style={pinned(mark.mid[0], mark.mid[1])}>
            <circle
              cx={0}
              cy={0}
              r={mark.open ? 5.5 : 7}
              opacity={mark.open ? 0.85 : 1}
              fill={mark.open ? palette.passageOpenFill : palette.passageClosedFill}
              stroke={mark.open ? palette.passageOpenRing : palette.passageClosedRing}
              strokeWidth={1.6}
            />
            <text
              x={0}
              y={3.2}
              textAnchor="middle"
              fontSize={8}
              fill={palette.passageInk}
              style={{ pointerEvents: "none" }}
            >
              {mark.kind === "canal" ? "C" : "S"}
            </text>
          </g>
        </g>
      ))}
    </>
  );
}
