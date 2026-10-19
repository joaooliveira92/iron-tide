import { pinned, screenText } from "../map-svg.js";
import { barHeight, type NationStrength, type RegionStrength } from "../map-strength.js";
import type { MapPalette } from "../map-palette.js";

/** Screen-pixel geometry of one glyph, relative to the area's label anchor. Shared with label layout. */
export const STRENGTH_GLYPH = {
  flagWidth: 15,
  flagHeight: 10,
  flagGap: 2,
  barWidth: 7,
  /**
   * Bottom of the flag row. It sits above the area name's first nudge slot (which reaches about
   * 36 px above the anchor), so a sea keeps its name beside its glyph.
   */
  flagsBottom: -38,
  /** Space for the ship count above the bar. */
  countRoom: 12,
} as const;

/** Vertical extent of a glyph above the anchor, for label avoidance. */
export function strengthExtent(
  region: RegionStrength,
  compact = false,
): { top: number; bottom: number } {
  const { flagsBottom, flagHeight, countRoom } = STRENGTH_GLYPH;
  const flagsTop = flagsBottom - flagHeight;
  return {
    top: flagsTop - 2 - barHeight(region.fraction, compact) - countRoom,
    bottom: flagsBottom,
  };
}

/** Half the glyph's width, for label avoidance. */
export function strengthHalfWidth(region: RegionStrength): number {
  const slots = region.flags.length + (region.overflow > 0 ? 1 : 0);
  const { flagWidth, flagGap } = STRENGTH_GLYPH;
  return (slots * flagWidth + (slots - 1) * flagGap) / 2;
}

export interface StrengthLayerProps {
  readonly regions: readonly RegionStrength[];
  /** Region id -> projected label anchor. */
  readonly anchorOf: (areaId: string) => readonly [number, number] | undefined;
  readonly strokeFor: (nation: string | null) => string;
  readonly palette: MapPalette;
  /** Shorter bars, for a small map (see `compactGlyphs`). */
  readonly compact?: boolean;
  /** Sideways shift in screen px per region (see `separateGlyphs`); absent means none. */
  readonly offsets?: ReadonlyMap<string, number>;
}

/**
 * Regional naval strength: a bar (height = ships relative to the strongest
 * region) over a short row of national flags, strongest first. Decorative and
 * transparent to the pointer: the same facts reach assistive tech through each
 * area's own label (`describeStrength`), so nothing here depends on colour,
 * bar height or flag art.
 */
export function StrengthLayer({
  regions,
  anchorOf,
  strokeFor,
  palette,
  compact = false,
  offsets,
}: StrengthLayerProps) {
  return (
    <g data-layer="strength" aria-hidden="true" pointerEvents="none">
      {regions.map((region) => {
        const anchor = anchorOf(region.areaId);
        if (anchor === undefined) return null;
        return (
          <g
            key={region.areaId}
            data-region={region.areaId}
            data-ships={region.total}
            data-compact={compact ? "" : undefined}
            style={pinned(anchor[0], anchor[1])}
          >
            <g transform={`translate(${offsets?.get(region.areaId) ?? 0} 0)`}>
              <Glyph region={region} strokeFor={strokeFor} palette={palette} compact={compact} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function Glyph({
  region,
  strokeFor,
  palette,
  compact,
}: {
  region: RegionStrength;
  strokeFor: (nation: string | null) => string;
  palette: MapPalette;
  compact: boolean;
}) {
  const { flagWidth, flagHeight, flagGap, barWidth, flagsBottom, countRoom } = STRENGTH_GLYPH;
  const height = barHeight(region.fraction, compact);
  const flagsTop = flagsBottom - flagHeight;
  const barBottom = flagsTop - 2;
  const barTop = barBottom - height;
  const slots = region.flags.length + (region.overflow > 0 ? 1 : 0);
  const rowWidth = slots * flagWidth + (slots - 1) * flagGap;
  const lead = region.flags[0];
  return (
    <>
      <rect
        x={-barWidth / 2 - 1}
        y={barTop - 1}
        width={barWidth + 2}
        height={height + 2}
        rx={1.5}
        fill={palette.strengthTrack}
        stroke={palette.strengthCasing}
        strokeWidth={1}
      />
      <rect
        x={-barWidth / 2}
        y={barTop}
        width={barWidth}
        height={height}
        rx={1}
        fill={strokeFor(lead?.nation ?? null)}
      />
      <text
        y={barTop - (countRoom - 9)}
        textAnchor="middle"
        fill={palette.strengthInk}
        stroke={palette.strengthHalo}
        paintOrder="stroke"
        fontWeight={700}
        style={screenText(10, 3)}
      >
        {region.total}
      </text>
      {region.flags.map((flag, index) => (
        <Flag
          key={flag.nation ?? "unclaimed"}
          flag={flag}
          x={-rowWidth / 2 + index * (flagWidth + flagGap)}
          y={flagsTop}
          fallback={strokeFor(flag.nation)}
          palette={palette}
        />
      ))}
      {region.overflow > 0 && (
        <g
          data-overflow={region.overflow}
          transform={`translate(${-rowWidth / 2 + region.flags.length * (flagWidth + flagGap)} ${flagsTop})`}
        >
          <rect
            width={flagWidth}
            height={flagHeight}
            rx={1.5}
            fill={palette.strengthTrack}
            stroke={palette.flagBorder}
            strokeWidth={0.8}
          />
          <text
            x={flagWidth / 2}
            y={flagHeight - 2}
            textAnchor="middle"
            fill={palette.strengthInk}
            fontWeight={700}
            style={screenText(8, 0)}
          >
            {`+${region.overflow}`}
          </text>
        </g>
      )}
    </>
  );
}

function Flag({
  flag,
  x,
  y,
  fallback,
  palette,
}: {
  flag: NationStrength;
  x: number;
  y: number;
  fallback: string;
  palette: MapPalette;
}) {
  const { flagWidth, flagHeight } = STRENGTH_GLYPH;
  return (
    <g transform={`translate(${x} ${y})`} data-nation={flag.nation ?? "unclaimed"}>
      {flag.flagUrl === null ? (
        <>
          <rect width={flagWidth} height={flagHeight} rx={1.5} fill={fallback} />
          <text
            x={flagWidth / 2}
            y={flagHeight - 2}
            textAnchor="middle"
            fill={palette.strengthHalo}
            fontWeight={700}
            style={screenText(8, 0)}
          >
            {flag.name.slice(0, 1)}
          </text>
        </>
      ) : (
        <image
          href={flag.flagUrl}
          width={flagWidth}
          height={flagHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      <rect
        width={flagWidth}
        height={flagHeight}
        rx={1.5}
        fill="none"
        stroke={palette.flagBorder}
        strokeWidth={0.8}
      />
    </g>
  );
}
