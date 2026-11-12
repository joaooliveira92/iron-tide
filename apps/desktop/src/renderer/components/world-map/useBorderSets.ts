import { useMemo } from "react";

import { campaignNationHue } from "../../content/presentationContent.js";
import { BORDERS_1880 } from "./borders-1880-data.js";
import { BORDER_FRONTIERS_1880 } from "./borders-1880-frontiers-data.js";
import type { BorderSet } from "./CoastlineCanvas.js";
import type { MapPalette } from "./map-palette.js";

export function useBorderSets(visible: boolean, palette: MapPalette): BorderSet[] {
  return useMemo<BorderSet[]>(
    () =>
      visible
        ? Object.entries(BORDERS_1880).map(([id, polygons]) => {
            const hue = campaignNationHue(id);
            return {
              id,
              polygons,
              frontiers: BORDER_FRONTIERS_1880[id] ?? [],
              tint: `oklch(${palette.borderTintLightness} 0.14 ${hue} / 0.16)`,
              edge: `oklch(${palette.borderEdgeLightness} 0.15 ${hue} / 0.9)`,
            };
          })
        : [],
    [palette, visible],
  );
}
