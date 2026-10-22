import type { ReactNode } from "react";
import Auralis from "../components/backgrounds/auralis.js";
import Nebulore from "../components/backgrounds/nebulore.js";
import PatternWaves from "../components/backgrounds/pattern-waves.js";
import { StarsBackground } from "../components/backgrounds/starts.js";
import { ShaderBackground } from "../components/motion/shader-background.js";
import {
  AURALIS_PALETTE,
  MESH_CITRUS_PALETTE,
  MESH_LAGOON_PALETTE,
  NEBULORE_PALETTE,
  PATTERN_WAVES_PALETTE,
  type ResolvedTheme,
  WATER_PALETTE,
} from "./background-palettes.js";
import type { BackgroundStyle } from "./BackgroundContext.js";

export type { ResolvedTheme } from "./background-palettes.js";

export interface BackgroundLayerProps {
  readonly background: BackgroundStyle;
  readonly resolvedTheme: ResolvedTheme;
}

type BackgroundRenderer = (resolvedTheme: ResolvedTheme) => ReactNode;

const BACKGROUND_RENDERERS: Record<BackgroundStyle, BackgroundRenderer> = {
  water: (theme) => {
    const palette = WATER_PALETTE[theme];
    return (
      <ShaderBackground
        variant="water"
        className="fixed inset-0 -z-10"
        colorBack={palette.colorBack}
        colorHighlight={palette.colorHighlight}
        speed={0.125}
      />
    );
  },
  stars: () => <StarsBackground className="fixed inset-0 -z-10" />,
  "mesh-citrus": (theme) => (
    <ShaderBackground
      variant="mesh-gradient"
      className="fixed inset-0 -z-10"
      colors={[...MESH_CITRUS_PALETTE[theme].colors]}
      distortion={0.8}
      swirl={0.4}
      speed={0.125}
    />
  ),
  "mesh-lagoon": (theme) => (
    <ShaderBackground
      variant="mesh-gradient"
      className="fixed inset-0 -z-10"
      colors={[...MESH_LAGOON_PALETTE[theme].colors]}
      distortion={0.8}
      swirl={0.4}
      speed={0.15}
    />
  ),
  auralis: (theme) => {
    const palette = AURALIS_PALETTE[theme];
    return (
      <Auralis
        className="fixed inset-0 -z-10"
        speed={0.03}
        colorBack={palette.colorBack}
        colors={palette.colors}
      />
    );
  },
  nebulore: (theme) => {
    const palette = NEBULORE_PALETTE[theme];
    return (
      <Nebulore
        className="fixed inset-0 -z-10"
        speed={0.025}
        colorBack={palette.colorBack}
        colors={palette.colors}
      />
    );
  },
  "pattern-waves": (theme) => {
    const palette = PATTERN_WAVES_PALETTE[theme];
    return (
      <PatternWaves
        className="fixed inset-0 -z-10"
        preset="silk"
        speed={0.2}
        opacity={0.18}
        color={palette.color}
        backgroundColor={palette.backgroundColor}
      />
    );
  },
  none: () => null,
};

export function BackgroundLayer({ background, resolvedTheme }: BackgroundLayerProps) {
  return <>{BACKGROUND_RENDERERS[background](resolvedTheme)}</>;
}
