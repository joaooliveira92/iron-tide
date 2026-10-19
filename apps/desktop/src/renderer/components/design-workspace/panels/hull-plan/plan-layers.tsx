import type { ZoneId } from "@bluewave/ship-design";
import { ZONE_IDS } from "@bluewave/ship-design";
import {
  DASH,
  LABEL_FONT,
  NON_SCALING,
  OPACITY,
  STATION_STEP_PERMILLE,
  STROKE,
} from "./drafting.js";
import { PLAN_MID, PLAN_PAD, PLAN_W, type PlanFrame } from "./geometry.js";

const PLAN_FONT = LABEL_FONT;

/** Length of the drawn ram beak, px (into the left padding). */
const RAM_LEN = 10;

/** Closed outline polygon points for the hull scaled by `scale` about the centreline. */
function outlinePoints(frame: PlanFrame, scale: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++)
    pts.push(`${frame.x(i * 25).toFixed(2)},${(PLAN_MID - frame.half(i / 40) * scale).toFixed(2)}`);
  for (let i = 40; i >= 0; i--)
    pts.push(`${frame.x(i * 25).toFixed(2)},${(PLAN_MID + frame.half(i / 40) * scale).toFixed(2)}`);
  return pts.join(" ");
}

/** Hull waterline, ram and deck edge: the hull's shape alone, also drawn magnified in the section cards. */
export function HullShapeLayer({ frame }: { readonly frame: PlanFrame }) {
  return (
    <>
      <polygon
        points={outlinePoints(frame, 1)}
        className="fill-background stroke-foreground"
        strokeWidth={STROKE.hull}
        strokeLinejoin="round"
        {...NON_SCALING}
        data-testid="hull-outline"
      />
      {frame.bow === "ram" && (
        <polygon
          points={`${frame.x(0)},${PLAN_MID - 1.5} ${frame.x(0) - RAM_LEN},${PLAN_MID} ${frame.x(0)},${PLAN_MID + 1.5}`}
          className="fill-foreground stroke-foreground"
          data-testid="hull-ram"
        />
      )}
      <polygon
        points={outlinePoints(frame, 0.9)}
        className="fill-none stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        strokeOpacity={OPACITY.deckEdge}
        {...NON_SCALING}
        data-testid="hull-deck-edge"
      />
    </>
  );
}

/**
 * The weather deck as a filled surface inside the hull plating, so the plan reads as a ship seen from above (hull
 * side lighter, deck darker) rather than an empty outline. Drawn under the section, armour and fitting layers.
 */
export function HullDeckLayer({ frame }: { readonly frame: PlanFrame }) {
  return (
    <polygon
      points={outlinePoints(frame, 0.9)}
      className="pointer-events-none fill-muted-foreground/25"
      data-testid="hull-deck-fill"
    />
  );
}

export function HullOutlineLayer({ frame }: { readonly frame: PlanFrame }) {
  const lcbX = frame.x(frame.lcbPermille);
  return (
    <>
      <HullShapeLayer frame={frame} />
      <line
        x1={frame.x(0)}
        x2={frame.x(1000)}
        y1={PLAN_MID}
        y2={PLAN_MID}
        className="stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        strokeOpacity={OPACITY.guide}
        strokeDasharray={DASH.centreline}
        {...NON_SCALING}
      />
      {Array.from(
        { length: 1000 / STATION_STEP_PERMILLE - 1 },
        (_, i) => (i + 1) * STATION_STEP_PERMILLE,
      ).map((p) => (
        <line
          key={p}
          x1={frame.x(p)}
          x2={frame.x(p)}
          y1={PLAN_MID - 3}
          y2={PLAN_MID + 3}
          className="stroke-muted-foreground"
          strokeWidth={STROKE.guide}
          strokeOpacity={OPACITY.guide}
          {...NON_SCALING}
        />
      ))}
      <g data-testid="hull-lcb">
        <circle cx={lcbX} cy={PLAN_MID} r={3.5} className="fill-none stroke-foreground" />
        <line
          x1={lcbX - 3.5}
          x2={lcbX + 3.5}
          y1={PLAN_MID}
          y2={PLAN_MID}
          className="stroke-foreground"
        />
        <line
          x1={lcbX}
          x2={lcbX}
          y1={PLAN_MID - 3.5}
          y2={PLAN_MID + 3.5}
          className="stroke-foreground"
        />
        <title>{`Centre of buoyancy, ${frame.lcbPermille}‰ from the bow`}</title>
      </g>
      <text x={PLAN_PAD} y={12} className="fill-muted-foreground" fontSize={PLAN_FONT}>
        bow
      </text>
      <text
        x={PLAN_W - PLAN_PAD}
        y={12}
        textAnchor="end"
        className="fill-muted-foreground"
        fontSize={PLAN_FONT}
      >
        stern
      </text>
      <text
        x={PLAN_W / 2}
        y={12}
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize={PLAN_FONT}
      >
        starboard ↑ · port ↓
      </text>
    </>
  );
}

/** Section boundaries. The section names are the interactive strip under the drawing (`SectionLabels`). */
export function HullZoneLayer({
  frame,
  zones,
}: {
  readonly frame: PlanFrame;
  readonly zones: readonly { id: string; startPermille: number; endPermille: number }[];
}) {
  return (
    <>
      {zones
        .filter(
          (z) => (ZONE_IDS as readonly string[]).includes(z.id) && (z.id as ZoneId) !== "MISSION",
        )
        .map((z) => (
          <g key={z.id}>
            <line
              x1={frame.x(z.startPermille)}
              x2={frame.x(z.startPermille)}
              y1={PLAN_MID - frame.maxHalf}
              y2={PLAN_MID + frame.maxHalf}
              className="stroke-muted-foreground"
              strokeDasharray={DASH.zoneGuide}
              strokeWidth={STROKE.guide}
              {...NON_SCALING}
            />
          </g>
        ))}
    </>
  );
}
