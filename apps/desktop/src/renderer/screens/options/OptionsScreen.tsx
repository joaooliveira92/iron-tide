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
import type { ReactNode } from "react";

import { BloomMenu } from "../../components/motion/bloom-menu.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Button } from "../../components/ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../../components/ui/card.js";
import {
  CURRENCY_DISPLAY_MODES,
  DEFAULT_APP_PREFERENCES,
  FORMATTING_LOCALES,
  LANGUAGE_PREFERENCES,
  MEASUREMENT_PRESETS,
  NUMBER_SCALE_PREFERENCES,
  REDUCED_MOTION_PREFERENCES,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  THEME_PREFERENCES,
  TOOLTIP_DETAIL_PREFERENCES,
  type AppPreferences,
} from "../../../shared/preferences-contract.js";
import type { BackgroundStyle } from "../../shell/BackgroundContext.js";
import { useBackground } from "../../shell/BackgroundContext.js";
import { DENSITY_OPTIONS, useDensity } from "../../shell/DensityContext.js";
import { SANS_FONT_OPTIONS, useFont } from "../../shell/FontContext.js";
import { useTheme } from "../../shell/ThemeContext.js";
import {
  MEASUREMENT_CATEGORIES,
  defaultDisplayUnit,
  displayUnitsForCategory,
  formatMoney,
} from "../../lib/presentation-format/index.js";
import { useCurrencyDisplayMode, usePreferences } from "../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../lib/strings.js";
import { useActiveCampaignCurrencyContext } from "../../shell/CampaignShellContext.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";
import { Tip } from "../../components/ui/tip.js";

const DEFAULTS = DEFAULT_APP_PREFERENCES;
const TEXT_SCALE_STEP = 5;

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

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { readonly value: T; readonly label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={option.value === value ? "default" : "outline"}
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Section({ titleKey, children }: { titleKey: MessageKey; children: ReactNode }) {
  return (
    <GlassCard>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{translate(titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </GlassCard>
  );
}

function MeasurementCategorySelects({
  preset,
  selections,
  onChange,
}: {
  preset: AppPreferences["measurementPreset"];
  selections: AppPreferences["measurementSelections"];
  onChange: (category: string, unitId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {MEASUREMENT_CATEGORIES.map((category) => {
        const label = translate(`settings.measurement.category.${category}`);
        const current = selections[category] ?? defaultDisplayUnit(category, preset).id;
        return (
          <label key={category} className="flex items-center justify-between gap-3 text-sm">
            <span>{label}</span>
            <select
              aria-label={label}
              className="rounded-md border border-input bg-background px-2 py-1"
              value={current}
              onChange={(event) => onChange(category, event.target.value)}
            >
              {displayUnitsForCategory(category).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.symbol}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

export function OptionsScreen() {
  const { background, setBackground } = useBackground();
  const { density, setDensity } = useDensity();
  const { font, setFont } = useFont();
  const { theme, setTheme } = useTheme();
  const { preferences, setApp } = usePreferences();
  const currencyContext = useActiveCampaignCurrencyContext();
  const currency = useCurrencyDisplayMode(currencyContext);

  const activeOption =
    BACKGROUND_OPTIONS.find((option) => option.value === background) ?? BACKGROUND_OPTIONS[0];
  const activeLabel = activeOption?.label ?? "Background";
  const activeIcon = activeOption?.icon ?? Palette;

  const resetSection = (patch: Partial<AppPreferences>) => setApp(patch);
  const resetAll = () => setApp(DEFAULTS);

  const clampTextScale = (next: number) => Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, next));

  const currencyReason =
    currency.fallbackReason === undefined
      ? undefined
      : translate(`settings.currency.unavailable.${currency.fallbackReason}`);
  const nationalAvailable =
    currency.requested === "nationalHistorical" && currencyReason === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title={translate("settings.title")}
        description={translate("settings.description")}
      />

      <Section titleKey="settings.section.general">
        <p className="text-sm text-muted-foreground">
          Your settings are stored for this profile and apply across every campaign.
        </p>
        <Button type="button" variant="outline" onClick={resetAll}>
          {translate("settings.reset.all")}
        </Button>
      </Section>

      <Section titleKey="settings.section.appearance">
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.theme.label")}</p>
          <OptionGroup
            label={translate("settings.theme.label")}
            value={theme}
            options={THEME_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.theme.${value}` as MessageKey),
            }))}
            onChange={setTheme}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.background.label")}</p>
          <BloomMenu
            title={activeLabel}
            triggerIcon={activeIcon}
            selected={activeLabel}
            items={BACKGROUND_OPTIONS.map((option) => ({ label: option.label, icon: option.icon }))}
            onSelect={(label) => {
              const option = BACKGROUND_OPTIONS.find((candidate) => candidate.label === label);
              if (option !== undefined) setBackground(option.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.font.label")}</p>
          <div
            role="group"
            aria-label={translate("settings.font.label")}
            className="flex flex-wrap gap-2"
          >
            {SANS_FONT_OPTIONS.map((option) => (
              <Tip label={option.description}>
                <Button
                  key={option.value}
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
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.density.label")}</p>
          <OptionGroup
            label={translate("settings.density.label")}
            value={density}
            options={DENSITY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            onChange={setDensity}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {translate("settings.textScale.label")}{" "}
            <span className="text-muted-foreground">{preferences.textScale}%</span>
          </p>
          <div
            role="group"
            aria-label={translate("settings.textScale.label")}
            className="flex gap-2"
          >
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
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            resetSection({
              theme: DEFAULTS.theme,
              background: DEFAULTS.background,
              font: DEFAULTS.font,
              interfaceDensity: DEFAULTS.interfaceDensity,
              textScale: DEFAULTS.textScale,
            })
          }
        >
          {translate("settings.reset.section")}
        </Button>
      </Section>

      <Section titleKey="settings.section.measurements">
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.measurement.preset")}</p>
          <OptionGroup
            label={translate("settings.measurement.preset")}
            value={preferences.measurementPreset}
            options={MEASUREMENT_PRESETS.map((value) => ({
              value,
              label: translate(`settings.measurement.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ measurementPreset: value })}
          />
        </div>
        <MeasurementCategorySelects
          preset={preferences.measurementPreset}
          selections={preferences.measurementSelections}
          onChange={(category, unitId) =>
            setApp({
              measurementSelections: { ...preferences.measurementSelections, [category]: unitId },
            })
          }
        />
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.numberScale.label")}</p>
          <OptionGroup
            label={translate("settings.numberScale.label")}
            value={preferences.numberScale}
            options={NUMBER_SCALE_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.numberScale.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ numberScale: value })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            resetSection({
              measurementPreset: DEFAULTS.measurementPreset,
              measurementSelections: DEFAULTS.measurementSelections,
              numberScale: DEFAULTS.numberScale,
            })
          }
        >
          {translate("settings.reset.section")}
        </Button>
      </Section>

      <Section titleKey="settings.section.currency">
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.currency.label")}</p>
          <OptionGroup
            label={translate("settings.currency.label")}
            value={currency.requested}
            options={CURRENCY_DISPLAY_MODES.map((value) => ({
              value,
              label: translate(`settings.currency.${value}` as MessageKey),
            }))}
            onChange={currency.setRequested}
          />
          <p className="text-sm text-muted-foreground" role="status">
            {nationalAvailable
              ? `${translate("settings.currency.nationalHistorical")}: ${formatMoney(12_000, {
                  locale: preferences.formattingLocale,
                  mode: currency.effective,
                })}`
              : (currencyReason ?? "")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => resetSection({ currencyDisplayMode: DEFAULTS.currencyDisplayMode })}
        >
          {translate("settings.reset.section")}
        </Button>
      </Section>

      <Section titleKey="settings.section.language">
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.language.label")}</p>
          <OptionGroup
            label={translate("settings.language.label")}
            value={preferences.language}
            options={LANGUAGE_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.language.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ language: value })}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.locale.label")}</p>
          <OptionGroup
            label={translate("settings.locale.label")}
            value={preferences.formattingLocale}
            options={FORMATTING_LOCALES.map((value) => ({
              value,
              label: translate(`settings.locale.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ formattingLocale: value })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            resetSection({
              language: DEFAULTS.language,
              formattingLocale: DEFAULTS.formattingLocale,
            })
          }
        >
          {translate("settings.reset.section")}
        </Button>
      </Section>

      <Section titleKey="settings.section.accessibility">
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.reducedMotion.label")}</p>
          <OptionGroup
            label={translate("settings.reducedMotion.label")}
            value={preferences.reducedMotion}
            options={REDUCED_MOTION_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.reducedMotion.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ reducedMotion: value })}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{translate("settings.tooltipDetail.label")}</p>
          <OptionGroup
            label={translate("settings.tooltipDetail.label")}
            value={preferences.tooltipDetail}
            options={TOOLTIP_DETAIL_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.tooltipDetail.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ tooltipDetail: value })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            resetSection({
              reducedMotion: DEFAULTS.reducedMotion,
              tooltipDetail: DEFAULTS.tooltipDetail,
            })
          }
        >
          {translate("settings.reset.section")}
        </Button>
      </Section>

      <Section titleKey="settings.section.advanced">
        <p className="text-sm text-muted-foreground">
          Advanced preferences are managed by the campaign and content packs.
        </p>
        <Button type="button" variant="ghost" onClick={resetAll}>
          {translate("settings.reset.all")}
        </Button>
      </Section>
    </div>
  );
}
