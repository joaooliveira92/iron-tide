/**
 * Chart-chrome colours. These are deliberately independent of `map-palette`
 * (which themes the map surface itself): the floating toolbars, inspector and
 * readouts read as a chart regardless of the app theme, so they keep their own
 * dark ink. Only the values the chrome actually uses live here.
 */
export const CHART = {
  ink: "oklch(0.92 0.01 240)",
  inkDim: "oklch(0.70 0.015 240)",
} as const;

/** Shared surface styling for the floating chrome panels. */
export const CHART_SURFACE = {
  background: "oklch(0.16 0.025 245 / 0.85)",
  borderColor: "oklch(0.4 0.02 245)",
} as const;
