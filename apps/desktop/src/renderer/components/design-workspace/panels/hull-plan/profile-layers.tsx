import { DASH, NON_SCALING, OPACITY, STROKE } from "./drafting.js";
import { type Point, polygonPoints, serializePath } from "./path.js";
import type { ProfileFrame } from "./profile-geometry.js";
import type { FunnelShape, HouseMasses } from "./profile-structures.js";

/** Datum offsets, px. */
const WATERLINE_OVERSHOOT = 12;
const PERPENDICULAR_TICK = 5;
const LCB_RADIUS = 3.5;
const DECK_EDGE_INSET = 2.5;
const FUNNEL_CAP_FRACTION = 0.12;

/** The funnel's cap band: a line across the funnel just below its top, at the funnel's width there. */
const capY = (f: FunnelShape) => f.topY + (f.baseY - f.topY) * FUNNEL_CAP_FRACTION;
const capLeftX = (f: FunnelShape) =>
  f.polygon[3]!.x + (f.polygon[0]!.x - f.polygon[3]!.x) * FUNNEL_CAP_FRACTION;
const capRightX = (f: FunnelShape) =>
  f.polygon[2]!.x + (f.polygon[1]!.x - f.polygon[2]!.x) * FUNNEL_CAP_FRACTION;

export function ProfileHullLayer({ frame }: { readonly frame: ProfileFrame }) {
  const deckEdge: Point[] = Array.from({ length: 41 }, (_, i) => ({
    x: frame.x(i * 25),
    y: frame.deckY(i / 40) + DECK_EDGE_INSET,
  })).slice(2, -2);
  return (
    <g>
      <path
        d={serializePath(frame.outline)}
        className="fill-background stroke-foreground"
        strokeWidth={STROKE.hull}
        strokeLinejoin="round"
        {...NON_SCALING}
        data-testid="profile-hull"
      />
      <polyline
        points={polygonPoints(deckEdge)}
        className="fill-none stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        strokeOpacity={OPACITY.deckEdge}
        {...NON_SCALING}
        data-testid="profile-deck-edge"
      />
    </g>
  );
}

export function ProfileFittingsLayer({
  houses,
  funnels,
}: {
  readonly houses: HouseMasses | undefined;
  readonly funnels: readonly FunnelShape[];
}) {
  return (
    <g>
      {houses && (
        <>
          <polygon
            points={polygonPoints(houses.lower)}
            className="fill-muted stroke-foreground"
            strokeWidth={STROKE.structure}
            strokeLinejoin="round"
            {...NON_SCALING}
            data-testid="profile-superstructure"
          />
          <polygon
            points={polygonPoints(houses.upper)}
            className="fill-muted stroke-foreground"
            strokeWidth={STROKE.structure}
            strokeLinejoin="round"
            {...NON_SCALING}
            data-testid="profile-bridge"
          />
        </>
      )}
      {funnels.map((f) => (
        <g key={f.instanceId} data-testid="profile-funnel" data-instance={f.instanceId}>
          <polygon
            points={polygonPoints(f.polygon)}
            className="fill-background stroke-foreground"
            strokeWidth={STROKE.structure}
            strokeLinejoin="round"
            {...NON_SCALING}
          />
          <line
            x1={capLeftX(f)}
            x2={capRightX(f)}
            y1={capY(f)}
            y2={capY(f)}
            className="stroke-foreground"
            strokeWidth={STROKE.structure}
            {...NON_SCALING}
          />
          <title>{`Funnel @ ${f.stationPermille}‰ (schematic shape)`}</title>
        </g>
      ))}
    </g>
  );
}

/** The design waterline with its perpendiculars and the centre of buoyancy, drawn over the hull. */
export function ProfileWaterlineLayer({
  frame,
  lcbPermille,
}: {
  readonly frame: ProfileFrame;
  readonly lcbPermille: number;
}) {
  const bowX = frame.x(0);
  const sternX = frame.x(1000);
  const lcbX = frame.x(lcbPermille);
  return (
    <g aria-hidden="true" data-testid="profile-waterline-layer">
      <line
        x1={bowX - WATERLINE_OVERSHOOT}
        x2={sternX + WATERLINE_OVERSHOOT / 2}
        y1={frame.waterlineY}
        y2={frame.waterlineY}
        className="stroke-primary"
        strokeWidth={STROKE.datum}
        strokeOpacity={OPACITY.datum}
        strokeDasharray={DASH.waterline}
        {...NON_SCALING}
        data-testid="profile-waterline"
      />
      {[bowX, sternX].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={frame.waterlineY - PERPENDICULAR_TICK}
          y2={frame.waterlineY + PERPENDICULAR_TICK}
          className="stroke-primary"
          strokeWidth={STROKE.datum}
          {...NON_SCALING}
        />
      ))}
      <g data-testid="profile-lcb">
        <circle
          cx={lcbX}
          cy={frame.waterlineY}
          r={LCB_RADIUS}
          className="fill-none stroke-foreground"
          strokeWidth={STROKE.guide}
          {...NON_SCALING}
        />
        <line
          x1={lcbX}
          x2={lcbX}
          y1={frame.waterlineY - LCB_RADIUS}
          y2={frame.waterlineY + LCB_RADIUS}
          className="stroke-foreground"
          strokeWidth={STROKE.guide}
          {...NON_SCALING}
        />
      </g>
    </g>
  );
}
