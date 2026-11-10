import {
  AudioWaveform,
  Ban,
  Citrus,
  Flame,
  Gem,
  Orbit,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import { Button } from "../../../components/ui/button.js";
import { Tip } from "../../../components/ui/tip.js";
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  THEME_PREFERENCES,
} from "../../../../shared/preferences-contract.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../../lib/strings.js";
import { useBackground, type BackgroundStyle } from "../../../shell/BackgroundContext.js";
import { DENSITY_OPTIONS, useDensity } from "../../../shell/DensityContext.js";
import { SANS_FONT_OPTIONS, useFont } from "../../../shell/FontContext.js";
import { useTheme } from "../../../shell/ThemeContext.js";
import { choicesFrom, OptionGroup } from "./OptionGroup.js";

const TEXT_SCALE_STEP = 5;

const BACKGROUND_OPTIONS: {
  label: string;
  value: BackgroundStyle;
  icon: LucideIcon;
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

function clampTextScale(next: number) {
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, next));
}

function TextScaleControl() {
  const { preferences, setApp } = usePreferences();
  return (
    <div role="group" aria-label={translate("settings.textScale.label")} className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        aria-label={translate("settings.textScale.decrease")}
        disabled={preferences.textScale <= TEXT_SCALE_MIN}
        onClick={() =>
          setApp({ textScale: clampTextScale(preferences.textScale - TEXT_SCALE_STEP) })
        }
      >
        A-
      </Button>
      <Button
        type="button"
        variant="outline"
        aria-label={translate("settings.textScale.increase")}
        disabled={preferences.textScale >= TEXT_SCALE_MAX}
        onClick={() =>
          setApp({ textScale: clampTextScale(preferences.textScale + TEXT_SCALE_STEP) })
        }
      >
        A+
      </Button>
    </div>
  );
}

function FontControl() {
  const { font, setFont } = useFont();
  return (
    <div
      role="group"
      aria-label={translate("settings.font.label")}
      className="flex flex-wrap gap-2"
    >
      {SANS_FONT_OPTIONS.map((option) => (
        <Tip key={option.value} label={option.description}>
          <Button
            type="button"
            variant={option.value === font ? "default" : "outline"}
            aria-pressed={option.value === font}
            onClick={() => setFont(option.value)}
          >
            <span data-font-option={option.value}>{option.label}</span>
          </Button>
        </Tip>
      ))}
    </div>
  );
}

export function AppearancePanel() {
  const { background, setBackground } = useBackground();
  const { density, setDensity } = useDensity();
  const { theme, setTheme } = useTheme();
  const { preferences } = usePreferences();
  return (
    <>
      <SettingsSection title={translate("settings.group.themeBackground")}>
        <SettingsRow
          title={translate("settings.theme.label")}
          description={translate("settings.theme.description")}
          control={
            <OptionGroup
              label={translate("settings.theme.label")}
              value={theme}
              options={choicesFrom(THEME_PREFERENCES, (value) =>
                translate(`settings.theme.${value}` as MessageKey),
              )}
              onChange={setTheme}
            />
          }
        />
        <SettingsRow
          stacked
          title={translate("settings.background.label")}
          description={translate("settings.background.description")}
          control={
            <OptionGroup
              label={translate("settings.background.label")}
              value={background}
              options={BACKGROUND_OPTIONS}
              onChange={setBackground}
            />
          }
        />
      </SettingsSection>
      <SettingsSection title={translate("settings.group.typeLayout")}>
        <SettingsRow
          stacked
          title={translate("settings.font.label")}
          description={translate("settings.font.description")}
          control={<FontControl />}
        />
        <SettingsRow
          title={translate("settings.density.label")}
          description={translate("settings.density.description")}
          control={
            <OptionGroup
              label={translate("settings.density.label")}
              value={density}
              options={DENSITY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={setDensity}
            />
          }
        />
        <SettingsRow
          title={
            <>
              {translate("settings.textScale.label")}{" "}
              <span className="font-display tabular-nums text-muted-foreground">
                {preferences.textScale}%
              </span>
            </>
          }
          description={translate("settings.textScale.description")}
          control={<TextScaleControl />}
        />
      </SettingsSection>
    </>
  );
}
