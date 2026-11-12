export type SurfacePreset = "silk" | "ocean" | "pond" | "lines" | "terminal" | "mesh";
export type PatternKind = "dot" | "square" | "plus" | "line" | "glyph";
export type WaveKind = "silk" | "swell" | "ripple";
export type FadeKind = "edges" | "center" | "bottom" | "top" | "none";
export type Rgba = [number, number, number, number];

export interface PresetValues {
  pattern: PatternKind;
  wave: WaveKind;
  spacing: number;
  markSize: number;
  depth: number;
  light: number;
  shine: number;
  contrast: number;
  speed: number;
  scale: number;
  direction: number;
}

export interface ResolvedSettings extends PresetValues {
  color: Rgba;
  background: Rgba;
  opacity: number;
  fade: FadeKind;
  fadeSize: number;
  characters: string;
  interactive: boolean;
  cursorSize: number;
  cursorStrength: number;
  intro: boolean;
  paused: boolean;
}

export type PresetOverrides = Partial<PresetValues> & {
  preset?: SurfacePreset;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  fade?: FadeKind;
  fadeSize?: number;
  characters?: string;
  interactive?: boolean;
  cursorSize?: number;
  cursorStrength?: number;
  intro?: boolean;
  paused?: boolean;
};

export const SURFACE_PRESETS: Record<SurfacePreset, PresetValues> = {
  silk: {
    pattern: "dot",
    wave: "silk",
    spacing: 9,
    markSize: 0.95,
    depth: 0.95,
    light: 0,
    shine: 0.8,
    contrast: 1.2,
    speed: 0.35,
    scale: 1,
    direction: 20,
  },
  ocean: {
    pattern: "dot",
    wave: "swell",
    spacing: 10,
    markSize: 0.9,
    depth: 0.42,
    light: 0,
    shine: 1,
    contrast: 1.2,
    speed: 0.5,
    scale: 1,
    direction: 100,
  },
  pond: {
    pattern: "dot",
    wave: "ripple",
    spacing: 10,
    markSize: 0.9,
    depth: 0.55,
    light: 0,
    shine: 1.2,
    contrast: 1.2,
    speed: 0.5,
    scale: 1,
    direction: 35,
  },
  lines: {
    pattern: "line",
    wave: "silk",
    spacing: 12,
    markSize: 0.42,
    depth: 0.9,
    light: 0,
    shine: 0.6,
    contrast: 1.2,
    speed: 0.3,
    scale: 1,
    direction: 20,
  },
  terminal: {
    pattern: "glyph",
    wave: "ripple",
    spacing: 13,
    markSize: 0.95,
    depth: 0.75,
    light: 0,
    shine: 0.9,
    contrast: 1.4,
    speed: 0.3,
    scale: 1.1,
    direction: 200,
  },
  mesh: {
    pattern: "plus",
    wave: "silk",
    spacing: 14,
    markSize: 0.8,
    depth: 0.95,
    light: 0,
    shine: 1,
    contrast: 1.45,
    speed: 0.4,
    scale: 1.1,
    direction: 325,
  },
};
