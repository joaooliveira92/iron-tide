import {
  PART_CATALOG,
  placeMasts,
  resolveMast,
  type FallbackStep,
  type PlacedMast,
} from "@bluewave/ship-visual";
import { TOP_PAD } from "./profile-constants.js";
import type { ProfileFrame } from "./profile-geometry.js";
import type { HouseMasses } from "./profile-structures.js";
import { ShapePath } from "./profile-mounts.js";
import type { VisualLook } from "./visualMounts.js";

export function mastStations(houses: HouseMasses | undefined): number[] {
  return houses ? [Math.round(houses.bridgeStartPermille), houses.endPermille] : [];
}

export interface MastSummary {
  readonly count: number;
  readonly style: VisualLook["style"];
  readonly era: VisualLook["era"];
  readonly partId: string;
  readonly step: FallbackStep;
}

export function mastSummary(look: VisualLook, hasSuperstructure: boolean): MastSummary | undefined {
  const resolution = resolveMast(PART_CATALOG, look.style, look.era);
  if (!hasSuperstructure || resolution === null) return undefined;
  return { count: 2, ...look, partId: resolution.part.id, step: resolution.step };
}

export function profileMasts(
  look: VisualLook,
  frame: ProfileFrame,
  houses: HouseMasses | undefined,
): PlacedMast[] {
  return placeMasts(PART_CATALOG, look, mastStations(houses), {
    x: frame.x,
    deckY: (p) => frame.deckY(p / 1000),
    houseTopY: (p) =>
      houses && p >= houses.startPermille && p <= houses.endPermille
        ? houses.lowerTopY(p / 1000)
        : undefined,
    pxPerM: frame.vScale,
    topY: TOP_PAD,
  });
}

export function ProfileMastLayer({ masts }: { readonly masts: readonly PlacedMast[] }) {
  if (masts.length === 0) return null;
  return (
    <g data-testid="profile-masts" aria-hidden="true">
      {masts.map((m) => (
        <g
          key={m.stationPermille}
          data-testid="profile-mast"
          data-station={m.stationPermille}
          data-part={m.partId}
          transform={`translate(${m.x} ${m.y}) scale(${m.scaleX} ${m.scaleY})`}
        >
          {m.part.profile.shapes.map((shape, i) => (
            <ShapePath key={i} shape={shape} />
          ))}
        </g>
      ))}
    </g>
  );
}
