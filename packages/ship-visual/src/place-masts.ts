import type { MastPart, PartCatalog } from "./catalog.js";
import { resolveMast, type FallbackStep } from "./resolve.js";
import type { NationStyle, VisualEra } from "./vocabulary.js";

/** The side profile a mast stands on, in px. Bow at the left, y down. */
export interface MastSurface {
  readonly x: (permille: number) => number;
  readonly deckY: (permille: number) => number;
  /** The superstructure's lower top at a station inside it, else undefined. */
  readonly houseTopY: (permille: number) => number | undefined;
  readonly pxPerM: number;
  /** The highest y a masthead may reach (the drawing's top pad). */
  readonly topY: number;
}

export interface PlacedMast {
  readonly stationPermille: number;
  readonly part: MastPart;
  readonly partId: string;
  readonly step: FallbackStep;
  readonly x: number;
  readonly y: number;
  /** px per authored metre across the mast: the profile scale, shrunk so the masthead stays under `topY`. */
  readonly scaleX: number;
  /** px per authored metre up the mast (equal to `scaleX`: masts are never distorted). */
  readonly scaleY: number;
}

/**
 * Masts at the given stations (a drawing convention: the caller chooses them from the superstructure), each standing
 * on the house top inside the superstructure, otherwise on the deck. A mast taller than the room above its seat is
 * shrunk as a whole (DISPLAY clamp), so its yards and tops keep their proportions. Pure; station order.
 */
export function placeMasts(
  catalog: PartCatalog,
  look: { readonly style: NationStyle; readonly era: VisualEra },
  stations: readonly number[],
  surface: MastSurface,
): PlacedMast[] {
  const resolution = resolveMast(catalog, look.style, look.era);
  if (resolution === null) return [];
  const { part, step } = resolution;
  return [...stations]
    .sort((a, b) => a - b)
    .map((stationPermille) => {
      const y = surface.houseTopY(stationPermille) ?? surface.deckY(stationPermille);
      const room = Math.max(0, y - surface.topY);
      const scale = Math.min(surface.pxPerM, room / part.profile.heightM);
      return {
        stationPermille,
        part,
        partId: part.id,
        step,
        x: surface.x(stationPermille),
        y,
        scaleX: scale,
        scaleY: scale,
      };
    });
}
