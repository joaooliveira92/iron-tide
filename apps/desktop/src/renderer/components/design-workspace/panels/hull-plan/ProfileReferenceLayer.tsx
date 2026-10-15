import { LABEL_FONT, NON_SCALING, OPACITY, STATION_STEP_PERMILLE, STROKE } from "./drafting.js";
import type { ProfileFrame } from "./profile-geometry.js";

/** Datum offsets, px. */
const BASELINE_DROP = 4;
const STATION_TICK = 3;
const MAJOR_STATION_TICK = 5;
const DIMENSION_OFFSET = 10;
const DIMENSION_STEP = 9;
const DIMENSION_CAP = 2.5;

const STATIONS = Array.from(
  { length: 1000 / STATION_STEP_PERMILLE + 1 },
  (_, i) => i * STATION_STEP_PERMILLE,
);

/** Reference geometry under the hull: baseline, station ticks, draught and depth marks. */
export function ProfileReferenceLayer({ frame }: { readonly frame: ProfileFrame }) {
  const baselineY = frame.keelBaseY + BASELINE_DROP;
  const bowX = frame.x(0);
  const sternX = frame.x(1000);
  const draughtX = sternX + DIMENSION_OFFSET;
  const depthX = draughtX + DIMENSION_STEP;
  const dimension = (x: number, fromY: number, toY: number, label: string) => (
    <g>
      <line
        x1={x}
        x2={x}
        y1={fromY}
        y2={toY}
        className="stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        {...NON_SCALING}
      />
      {[fromY, toY].map((y) => (
        <line
          key={y}
          x1={x - DIMENSION_CAP}
          x2={x + DIMENSION_CAP}
          y1={y}
          y2={y}
          className="stroke-muted-foreground"
          strokeWidth={STROKE.guide}
          {...NON_SCALING}
        />
      ))}
      <text
        x={x + DIMENSION_CAP + 1.5}
        y={(fromY + toY) / 2 + LABEL_FONT / 3}
        className="fill-muted-foreground"
        fontSize={LABEL_FONT}
      >
        {label}
      </text>
    </g>
  );
  return (
    <g aria-hidden="true" data-testid="profile-datums">
      <line
        x1={bowX}
        x2={sternX}
        y1={baselineY}
        y2={baselineY}
        className="stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        strokeOpacity={OPACITY.guide}
        {...NON_SCALING}
      />
      {STATIONS.map((station) => {
        const major = station % 500 === 0;
        return (
          <line
            key={station}
            x1={frame.x(station)}
            x2={frame.x(station)}
            y1={baselineY}
            y2={baselineY + (major ? MAJOR_STATION_TICK : STATION_TICK)}
            className="stroke-muted-foreground"
            strokeWidth={STROKE.guide}
            strokeOpacity={OPACITY.guide}
            {...NON_SCALING}
          />
        );
      })}
      {dimension(draughtX, frame.waterlineY, frame.keelBaseY, "T")}
      {dimension(depthX, frame.deckMidY, frame.keelBaseY, "D")}
    </g>
  );
}
