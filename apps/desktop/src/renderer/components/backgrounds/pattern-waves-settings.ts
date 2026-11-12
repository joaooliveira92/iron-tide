import {
  SURFACE_PRESETS,
  type FadeKind,
  type PatternKind,
  type PresetOverrides,
  type PresetValues,
  type ResolvedSettings,
  type Rgba,
  type WaveKind,
} from "./pattern-waves-presets.js";

export const PATTERNS: Record<PatternKind, number> = {
  dot: 0,
  square: 1,
  plus: 2,
  line: 3,
  glyph: 4,
};
export const WAVES: Record<WaveKind, number> = { silk: 0, swell: 1, ripple: 2 };
export const FADES: Record<FadeKind, number> = { none: 0, edges: 1, center: 2, bottom: 3, top: 4 };
export const DEFAULT_CHARACTERS = ".:-=+*#%@";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const luminance = (rgba: Rgba) => 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2];

const HEX_COLOR = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function parseColor(value: string, fallback: Rgba): Rgba {
  const trimmed = value.trim();

  const hexMatch = HEX_COLOR.exec(trimmed);
  if (hexMatch) {
    const digits = hexMatch[1] ?? "";
    const expand = digits.length <= 4;
    const step = expand ? 1 : 2;
    const channels: number[] = [];
    for (let index = 0; index + step <= digits.length; index += step) {
      const chunk = digits.slice(index, index + step);
      const parsed = Number.parseInt(expand ? chunk + chunk : chunk, 16);
      channels.push(parsed / 255);
    }
    if (channels.length >= 3) {
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, channels[3] ?? 1];
    }
  }

  const functional = /^rgba?\(([^)]+)\)$/i.exec(trimmed);
  if (functional) {
    const parts = (functional[1] ?? "").split(/[,\s/]+/).filter((part) => part.length > 0);
    if (parts.length >= 3) {
      const r = Number.parseFloat(parts[0] ?? "");
      const g = Number.parseFloat(parts[1] ?? "");
      const b = Number.parseFloat(parts[2] ?? "");
      const a = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1;
      if ([r, g, b, a].every(Number.isFinite)) {
        return [
          clamp(r, 0, 255) / 255,
          clamp(g, 0, 255) / 255,
          clamp(b, 0, 255) / 255,
          clamp(a, 0, 1),
        ];
      }
    }
  }

  return fallback;
}

export function resolveSettings(overrides: PresetOverrides): ResolvedSettings {
  const base = SURFACE_PRESETS[overrides.preset ?? "silk"] ?? SURFACE_PRESETS.silk;
  const presetValues: Partial<PresetValues> = overrides;
  const pick = <K extends keyof PresetValues>(key: K): PresetValues[K] =>
    presetValues[key] ?? base[key];

  return {
    color: parseColor(overrides.color ?? "#ffffff", [1, 1, 1, 1]),
    background: parseColor(overrides.backgroundColor ?? "#000000", [0, 0, 0, 1]),
    pattern: pick("pattern"),
    wave: pick("wave"),
    spacing: pick("spacing"),
    markSize: pick("markSize"),
    depth: pick("depth"),
    light: pick("light"),
    shine: pick("shine"),
    contrast: pick("contrast"),
    speed: pick("speed"),
    scale: pick("scale"),
    direction: pick("direction"),
    opacity: overrides.opacity ?? 1,
    fade: overrides.fade ?? "edges",
    fadeSize: overrides.fadeSize ?? 0.5,
    characters: overrides.characters ?? DEFAULT_CHARACTERS,
    interactive: overrides.interactive ?? true,
    cursorSize: overrides.cursorSize ?? 50,
    cursorStrength: overrides.cursorStrength ?? 0.6,
    intro: overrides.intro ?? true,
    paused: overrides.paused ?? false,
  };
}
