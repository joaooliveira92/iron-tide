import type { MastPart, PartCatalog } from "./catalog.js";
import { resolveMast, type FallbackStep } from "./resolve.js";
import type { NationStyle, VisualEra } from "./vocabulary.js";

export interface MastSurface {
  readonly x: (permille: number) => number;
  readonly deckY: (permille: number) => number;
  readonly houseTopY: (permille: number) => number | undefined;
  readonly pxPerM: number;
  readonly topY: number;
}

export interface PlacedMast {
  readonly stationPermille: number;
  readonly part: MastPart;
  readonly partId: string;
  readonly step: FallbackStep;
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

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
