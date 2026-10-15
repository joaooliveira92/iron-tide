export type ResolvedTheme = "light" | "dark";

export interface ColorPalette {
  readonly colorBack: string;
  readonly colors: readonly string[];
}

export interface WaterPalette {
  readonly colorBack: string;
  readonly colorHighlight: string;
}

export interface MeshPalette {
  readonly colors: readonly string[];
}

export interface PatternWavesPalette {
  readonly color: string;
  readonly backgroundColor: string;
}

const freezeColors = (colors: readonly string[]): readonly string[] => Object.freeze([...colors]);

const freezeTheme = <T extends object>(light: T, dark: T): Record<ResolvedTheme, T> =>
  Object.freeze({ light: Object.freeze(light), dark: Object.freeze(dark) });

export const AURALIS_PALETTE = freezeTheme<ColorPalette>(
  { colorBack: "#fff5f5", colors: freezeColors(["#ffb3b3", "#ff8a8a", "#ff6b6b"]) },
  { colorBack: "#010103", colors: freezeColors(["#ef4444", "#dc2626", "#b91c1c"]) },
);

export const NEBULORE_PALETTE = freezeTheme<ColorPalette>(
  { colorBack: "#f5f5ff", colors: freezeColors(["#c7d2fe", "#d8b4fe", "#a5f3fc"]) },
  { colorBack: "#010103", colors: freezeColors(["#312e81", "#9333ea", "#22d3ee"]) },
);

export const WATER_PALETTE = freezeTheme<WaterPalette>(
  { colorBack: "#dbe9f4", colorHighlight: "#ffffff" },
  { colorBack: "#010101", colorHighlight: "#121212" },
);

export const MESH_CITRUS_PALETTE = freezeTheme<MeshPalette>(
  { colors: freezeColors(["#fff8e8", "#ffd166", "#d4f0a0", "#ffb84d"]) },
  { colors: freezeColors(["#020202", "#2b1400", "#0f1a05", "#402008"]) },
);

export const MESH_LAGOON_PALETTE = freezeTheme<MeshPalette>(
  { colors: freezeColors(["#f0fffa", "#5eead4", "#38bdf8", "#a78bfa"]) },
  { colors: freezeColors(["#020a0a", "#0a2e2e", "#042a40", "#1a0a40"]) },
);

export const PATTERN_WAVES_PALETTE = freezeTheme<PatternWavesPalette>(
  { color: "#cdd6e2", backgroundColor: "#eef3f8" },
  { color: "#232833", backgroundColor: "#010103" },
);
