const SIX_DIGIT_HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

/** Returns one canonical six-digit hex color, falling back for invalid input. */
export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!SIX_DIGIT_HEX_COLOR.test(trimmed)) return fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

/** Converts a six-digit hex color into WebGL-normalized RGB components. */
export function hexToNormalizedRgb(value: string, fallback: string): [number, number, number] {
  const normalized = normalizeHexColor(value, fallback).slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}
