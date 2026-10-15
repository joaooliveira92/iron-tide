import { pinned } from "../map-svg.js";
import type { PassageMark } from "../useWorldMapModel.js";

/** Passage badges, drawn at the midpoint of the edge they gate. */
export function PassagesLayer({ marks }: { marks: readonly PassageMark[] }) {
  return (
    <>
      {marks.map((mark) => (
        <g key={mark.id}>
          <line
            x1={mark.from[0]}
            y1={mark.from[1]}
            x2={mark.to[0]}
            y2={mark.to[1]}
            stroke={mark.open ? "oklch(0.75 0.02 240 / 0.3)" : "oklch(0.65 0.2 25 / 0.55)"}
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
              fill={mark.open ? "oklch(0.28 0.03 245)" : "oklch(0.36 0.11 25)"}
              stroke={mark.open ? "oklch(0.8 0.02 240)" : "oklch(0.72 0.2 25)"}
              strokeWidth={1.6}
            />
            <text
              x={0}
              y={3.2}
              textAnchor="middle"
              fontSize={8}
              fill="oklch(0.92 0.01 240)"
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
