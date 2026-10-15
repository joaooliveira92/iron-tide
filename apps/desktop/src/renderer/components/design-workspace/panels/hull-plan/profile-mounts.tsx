import {
  PART_CATALOG,
  placeMounts,
  wholeInches,
  type MountClass,
  type PlacedMount,
  type Shape,
  type Tone,
  type VisualMountInput,
} from "@bluewave/ship-visual";
import { NON_SCALING, STROKE } from "./drafting.js";
import type { ProfileFrame } from "./profile-geometry.js";
import type { HouseMasses } from "./profile-structures.js";
import type { VisualLook } from "./visualMounts.js";

/** Catalog tones on the drawing's theme tokens, so parts follow light and dark themes with the hull. */
export const TONE_CLASS: Readonly<Record<Tone, string>> = {
  structure: "fill-muted stroke-foreground",
  gun: "fill-foreground stroke-foreground",
  void: "fill-background stroke-foreground",
};

const CLASS_NAME: Readonly<Record<MountClass, string>> = {
  TURRET: "Turret",
  BARBETTE: "Barbette",
  SHIELDED: "Shielded mount",
  OPEN: "Open mount",
  CASEMATE: "Casemate",
};

/** CONVENTION: far-side (port) mounts are seen through the ship, so they draw muted. */
const FAR_OPACITY = 0.5;

/** The gun mounts of a design seated in the profile (station, house top or deck, calibre scale). */
export function profileMounts(
  inputs: readonly VisualMountInput[],
  look: VisualLook,
  frame: ProfileFrame,
  houses: HouseMasses | undefined,
) {
  return placeMounts(PART_CATALOG, inputs, look, {
    x: frame.x,
    deckY: (p) => frame.deckY(p / 1000),
    houseTopY: (p) =>
      houses && p >= houses.startPermille && p <= houses.endPermille
        ? houses.lowerTopY(p / 1000)
        : undefined,
    pxPerM: frame.vScale,
  });
}

export const mountTitle = (m: PlacedMount): string =>
  `${CLASS_NAME[m.mountClass]}, ${m.gunCount} × ${wholeInches(m.caliberUm)} in @ ${m.stationPermille}‰`;

export function ShapePath({ shape }: { readonly shape: Shape }) {
  return (
    <path
      d={shape.d}
      className={TONE_CLASS[shape.tone]}
      strokeWidth={STROKE.guide}
      strokeLinejoin="round"
      {...NON_SCALING}
    />
  );
}

/** Gun mounts drawn from the part catalog, in front of the superstructure (manual p137 layering). */
export function ProfileMountLayer({ placed }: { readonly placed: readonly PlacedMount[] }) {
  if (placed.length === 0) return null;
  return (
    <g data-testid="profile-mounts">
      {placed.map((m) => {
        const { barrel, shapes } = m.part.profile;
        const flip = m.facing === "STERN" ? -1 : 1;
        return (
          <g
            key={m.instanceId}
            data-testid="profile-mount"
            data-instance={m.instanceId}
            data-part={m.partId}
            data-step={m.step}
            data-far={m.far || undefined}
            opacity={m.far ? FAR_OPACITY : undefined}
          >
            <title>{mountTitle(m)}</title>
            {m.symbols.map((s, i) => (
              <g key={i} transform={`translate(${s.x} ${s.y}) scale(${flip * s.scale} ${s.scale})`}>
                {/* The barrel first, so its breech end tucks behind the body. */}
                <rect
                  x={barrel.x - barrel.lengthM}
                  y={barrel.y - barrel.boreM / 2}
                  width={barrel.lengthM + 1}
                  height={barrel.boreM}
                  className={TONE_CLASS.gun}
                  strokeWidth={0}
                />
                {shapes.map((shape, j) => (
                  <ShapePath key={j} shape={shape} />
                ))}
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}
