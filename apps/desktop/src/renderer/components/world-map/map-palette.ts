/**
 * Colours for the map surface itself (land, graticule, area edges, labels).
 * The ocean is transparent, so these have to read against the app background
 * in both themes. Floating chrome (panels, readouts) keeps its own dark
 * styling and does not use this.
 */

import { useSyncExternalStore } from "react";

export interface MapPalette {
  readonly land: string;
  readonly landEdge: string;
  readonly graticule: string;
  readonly areaEdge: string;
  readonly areaWash: string;
  readonly areaWashSelected: string;
  readonly selectedEdge: string;
  readonly route: string;
  readonly labelInk: string;
  readonly labelHalo: string;
  /** OKLCH lightness for nation border tints and lines (hue comes from the nation). */
  readonly borderTintLightness: number;
  readonly borderEdgeLightness: number;
  /** The minimap inset: its own surface, since the main ocean is transparent. */
  readonly minimapOcean: string;
  readonly minimapLand: string;
  readonly minimapInk: string;
  readonly minimapBorder: string;
}

export const DARK_MAP_PALETTE: MapPalette = {
  land: "oklch(0.30 0.018 250)",
  landEdge: "oklch(0.42 0.02 250)",
  graticule: "oklch(0.40 0.02 245 / 0.45)",
  areaEdge: "oklch(0.75 0.02 240 / 0.2)",
  areaWash: "oklch(0.7 0.02 240 / 0.11)",
  areaWashSelected: "oklch(0.7 0.02 240 / 0.25)",
  selectedEdge: "oklch(0.92 0.01 240)",
  route: "oklch(0.85 0.16 85)",
  labelInk: "oklch(0.95 0.01 240)",
  labelHalo: "oklch(0.15 0.02 245 / 0.8)",
  borderTintLightness: 0.7,
  borderEdgeLightness: 0.74,
  minimapOcean: "oklch(0.19 0.035 245)",
  minimapLand: "oklch(0.30 0.018 250)",
  minimapInk: "oklch(0.92 0.01 240)",
  minimapBorder: "oklch(0.4 0.02 245)",
};

export const LIGHT_MAP_PALETTE: MapPalette = {
  land: "oklch(0.86 0.014 250)",
  landEdge: "oklch(0.66 0.02 250)",
  graticule: "oklch(0.55 0.02 245 / 0.22)",
  areaEdge: "oklch(0.45 0.03 245 / 0.22)",
  areaWash: "oklch(0.6 0.03 245 / 0.1)",
  areaWashSelected: "oklch(0.5 0.05 245 / 0.22)",
  selectedEdge: "oklch(0.2 0.02 250)",
  route: "oklch(0.55 0.17 55)",
  labelInk: "oklch(0.22 0.02 250)",
  labelHalo: "oklch(0.98 0.005 240 / 0.85)",
  borderTintLightness: 0.6,
  borderEdgeLightness: 0.5,
  minimapOcean: "oklch(0.96 0.01 245)",
  minimapLand: "oklch(0.78 0.015 250)",
  minimapInk: "oklch(0.25 0.02 250)",
  minimapBorder: "oklch(0.75 0.015 250)",
};

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** The map palette for the current theme (the app toggles `.dark` on `<html>`). */
export function useMapPalette(): MapPalette {
  return useSyncExternalStore(subscribe, isDark, () => true) ? DARK_MAP_PALETTE : LIGHT_MAP_PALETTE;
}
