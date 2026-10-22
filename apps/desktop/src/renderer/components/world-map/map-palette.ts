import { useSyncExternalStore } from "react";

export interface MapPalette {
  readonly ocean: string;
  readonly land: string;
  readonly landEdge: string;
  readonly graticule: string;
  readonly areaEdge: string;
  readonly areaWash: string;
  readonly areaWashSelected: string;
  readonly selectedEdge: string;
  readonly hoverEdge: string;
  readonly areaUnavailable: string;
  readonly route: string;
  readonly routeCasing: string;
  readonly lane: string;
  readonly passageOpenLine: string;
  readonly passageClosedLine: string;
  readonly passageOpenFill: string;
  readonly passageClosedFill: string;
  readonly passageOpenRing: string;
  readonly passageClosedRing: string;
  readonly passageInk: string;
  readonly strengthTrack: string;
  readonly strengthCasing: string;
  readonly strengthInk: string;
  readonly strengthHalo: string;
  readonly flagBorder: string;
  readonly labelInk: string;
  readonly labelHalo: string;
  readonly borderTintLightness: number;
  readonly borderEdgeLightness: number;
  readonly minimapOcean: string;
  readonly minimapLand: string;
  readonly minimapInk: string;
  readonly minimapBorder: string;
}

export const DARK_MAP_PALETTE: MapPalette = {
  ocean: "oklch(0.2 0.045 240)",
  land: "oklch(0.36 0.045 150)",
  landEdge: "oklch(0.5 0.05 150)",
  graticule: "oklch(0.40 0.02 245 / 0.45)",
  areaEdge: "oklch(0.75 0.02 240 / 0.2)",
  areaWash: "oklch(0.7 0.02 240 / 0.11)",
  areaWashSelected: "oklch(0.7 0.02 240 / 0.25)",
  selectedEdge: "oklch(0.92 0.01 240)",
  hoverEdge: "oklch(0.82 0.1 230)",
  areaUnavailable: "oklch(0.3 0.01 250 / 0.38)",
  route: "oklch(0.85 0.16 85)",
  routeCasing: "oklch(0.2 0 0 / 0.6)",
  lane: "oklch(0.8 0.05 215 / 0.55)",
  passageOpenLine: "oklch(0.75 0.02 240 / 0.3)",
  passageClosedLine: "oklch(0.65 0.2 25 / 0.55)",
  passageOpenFill: "oklch(0.28 0.03 245)",
  passageClosedFill: "oklch(0.36 0.11 25)",
  passageOpenRing: "oklch(0.8 0.02 240)",
  passageClosedRing: "oklch(0.72 0.2 25)",
  passageInk: "oklch(0.92 0.01 240)",
  strengthTrack: "oklch(0.15 0.02 245 / 0.55)",
  strengthCasing: "oklch(0.97 0.005 240)",
  strengthInk: "oklch(0.97 0.005 240)",
  strengthHalo: "oklch(0.15 0.02 245 / 0.9)",
  flagBorder: "oklch(0.97 0.005 240 / 0.9)",
  labelInk: "oklch(0.95 0.01 240)",
  labelHalo: "oklch(0.15 0.02 245 / 0.8)",
  borderTintLightness: 0.7,
  borderEdgeLightness: 0.74,
  minimapOcean: "oklch(0.19 0.035 245)",
  minimapLand: "oklch(0.36 0.045 150)",
  minimapInk: "oklch(0.92 0.01 240)",
  minimapBorder: "oklch(0.4 0.02 245)",
};

export const LIGHT_MAP_PALETTE: MapPalette = {
  ocean: "oklch(0.9 0.045 230)",
  land: "oklch(0.8 0.08 140)",
  landEdge: "oklch(0.55 0.08 145)",
  graticule: "oklch(0.55 0.02 245 / 0.22)",
  areaEdge: "oklch(0.45 0.03 245 / 0.22)",
  areaWash: "oklch(0.6 0.03 245 / 0.1)",
  areaWashSelected: "oklch(0.5 0.05 245 / 0.22)",
  selectedEdge: "oklch(0.2 0.02 250)",
  hoverEdge: "oklch(0.4 0.12 240)",
  areaUnavailable: "oklch(0.62 0.01 250 / 0.3)",
  route: "oklch(0.55 0.17 55)",
  routeCasing: "oklch(0.98 0.005 240 / 0.85)",
  lane: "oklch(0.42 0.08 235 / 0.6)",
  passageOpenLine: "oklch(0.45 0.03 245 / 0.4)",
  passageClosedLine: "oklch(0.55 0.2 25 / 0.7)",
  passageOpenFill: "oklch(0.97 0.01 245)",
  passageClosedFill: "oklch(0.93 0.05 25)",
  passageOpenRing: "oklch(0.4 0.03 245)",
  passageClosedRing: "oklch(0.5 0.2 25)",
  passageInk: "oklch(0.25 0.02 250)",
  strengthTrack: "oklch(0.98 0.005 240 / 0.6)",
  strengthCasing: "oklch(0.2 0.02 250)",
  strengthInk: "oklch(0.2 0.02 250)",
  strengthHalo: "oklch(0.98 0.005 240 / 0.92)",
  flagBorder: "oklch(0.2 0.02 250 / 0.8)",
  labelInk: "oklch(0.22 0.02 250)",
  labelHalo: "oklch(0.98 0.005 240 / 0.85)",
  borderTintLightness: 0.6,
  borderEdgeLightness: 0.5,
  minimapOcean: "oklch(0.96 0.01 245)",
  minimapLand: "oklch(0.8 0.08 140)",
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

export function useMapPalette(): MapPalette {
  return useSyncExternalStore(subscribe, isDark, () => true) ? DARK_MAP_PALETTE : LIGHT_MAP_PALETTE;
}
