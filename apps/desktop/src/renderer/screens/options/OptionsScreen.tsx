import {
  AudioWaveform,
  Ban,
  Citrus,
  Flame,
  Gem,
  Orbit,
  Palette,
  Settings,
  Sparkles,
  Waves,
} from "lucide-react";
import { BloomMenu } from "../../components/motion/bloom-menu.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Button } from "../../components/ui/button.js";
import { CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.js";
import type { BackgroundStyle } from "../../shell/BackgroundContext.js";
import { useBackground } from "../../shell/BackgroundContext.js";
import { DENSITY_OPTIONS, useDensity } from "../../shell/DensityContext.js";
import { SANS_FONT_OPTIONS, useFont } from "../../shell/FontContext.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";

const BACKGROUND_OPTIONS: {
  label: string;
  value: BackgroundStyle;
  icon: typeof Waves;
}[] = [
  { label: "Water", value: "water", icon: Waves },
  { label: "Starfield", value: "stars", icon: Sparkles },
  { label: "Mesh - Citrus", value: "mesh-citrus", icon: Citrus },
  { label: "Mesh - Lagoon", value: "mesh-lagoon", icon: Gem },
  { label: "Auralis", value: "auralis", icon: Flame },
  { label: "Nebulore", value: "nebulore", icon: Orbit },
  { label: "Pattern Waves", value: "pattern-waves", icon: AudioWaveform },
  { label: "None", value: "none", icon: Ban },
];

export function OptionsScreen() {
  const { background, setBackground } = useBackground();
  const { density, setDensity } = useDensity();
  const { font, setFont } = useFont();
  const activeOption =
    BACKGROUND_OPTIONS.find((option) => option.value === background) ?? BACKGROUND_OPTIONS[0];
  const activeLabel = activeOption?.label ?? "Background";
  const activeIcon = activeOption?.icon ?? Palette;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Options"
        description="Appearance and display. Save, copy and close live in the header Campaign menu."
      />

      <GlassCard>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Background</CardTitle>
          <CardDescription>Choose the animated backdrop behind the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <BloomMenu
            title={activeLabel}
            triggerIcon={activeIcon}
            selected={activeLabel}
            items={BACKGROUND_OPTIONS.map((option) => ({
              label: option.label,
              icon: option.icon,
            }))}
            onSelect={(label) => {
              const option = BACKGROUND_OPTIONS.find((candidate) => candidate.label === label);
              if (option !== undefined) setBackground(option.value);
            }}
          />
        </CardContent>
      </GlassCard>

      <GlassCard>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Application font</CardTitle>
          <CardDescription>
            The body typeface used across the app. Code and data stay monospaced.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="group" aria-label="Application font" className="flex flex-wrap gap-2">
            {SANS_FONT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={option.value === font ? "default" : "outline"}
                aria-pressed={option.value === font}
                title={option.description}
                onClick={() => setFont(option.value)}
              >
                <span data-font-option={option.value}>{option.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </GlassCard>

      <GlassCard>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Display density</CardTitle>
          <CardDescription>
            How much fits on screen. Compact tightens spacing across every screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="group" aria-label="Display density" className="flex flex-wrap gap-2">
            {DENSITY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={option.value === density ? "default" : "outline"}
                aria-pressed={option.value === density}
                title={option.description}
                onClick={() => setDensity(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </GlassCard>
    </div>
  );
}
