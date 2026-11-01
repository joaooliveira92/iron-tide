import {
  AudioWaveform,
  Ban,
  Citrus,
  Flame,
  Gem,
  Orbit,
  Settings,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { PageHeader } from "../../components/shared/PageHeader.js";
import { DepartmentDrawer } from "../../components/slate/DepartmentDrawer.js";
import { IndexTabs } from "../../components/slate/IndexTabs.js";
import { Button } from "../../components/ui/button.js";
import { Tip } from "../../components/ui/tip.js";
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
import { formatMoney } from "../../lib/presentation-format/money.js";
import {
  MEASUREMENT_CATEGORIES,
  defaultDisplayUnit,
  displayUnitsForCategory,
} from "../../lib/presentation-format/units.js";
import { useCurrencyDisplayMode, usePreferences } from "../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../lib/strings.js";
import { useActiveCampaignCurrencyContext } from "../../shell/CampaignShellContext.js";
import { useMinWidth } from "../../lib/use-min-width.js";
import { COMMAND_OVERLAY_MIN_WIDTH } from "../overview/hooks/useOverviewModel.js";
import {
  optionsDepartmentMeta,
  optionsIndexTabs,
  type OptionsDepartment,
} from "./options-departments.js";

const DEFAULTS = DEFAULT_APP_PREFERENCES;
const TEXT_SCALE_STEP = 5;

const SELECT_CLASS = "h-8 min-w-0 rounded-md border bg-background px-2 text-sm";

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

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { readonly value: T; readonly label: string; readonly icon?: LucideIcon }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant={option.value === value ? "default" : "outline"}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {Icon !== undefined ? <Icon aria-hidden="true" /> : null}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
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
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {MEASUREMENT_CATEGORIES.map((category) => {
        const label = translate(`settings.measurement.category.${category}` as MessageKey);
        const current = selections[category] ?? defaultDisplayUnit(category, preset).id;
        return (
          <label key={category} className="flex items-center justify-between gap-2 text-sm">
            <span>{label}</span>
            <select
              aria-label={label}
              className={SELECT_CLASS}
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
  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const [department, setDepartment] = useState<OptionsDepartment | null>("appearance");

  const clampTextScale = (next: number) => Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, next));

  const currencyReason =
    currency.fallbackReason === undefined
      ? undefined
      : translate(`settings.currency.unavailable.${currency.fallbackReason}` as MessageKey);
  const nationalAvailable =
    currency.requested === "nationalHistorical" && currencyReason === undefined;

  const resetDepartment = (id: OptionsDepartment) => {
    switch (id) {
      case "general":
        setApp(DEFAULTS);
        return;
      case "appearance":
        setApp({
          theme: DEFAULTS.theme,
          background: DEFAULTS.background,
          font: DEFAULTS.font,
          interfaceDensity: DEFAULTS.interfaceDensity,
          textScale: DEFAULTS.textScale,
        });
        return;
      case "measurements":
        setApp({
          measurementPreset: DEFAULTS.measurementPreset,
          measurementSelections: DEFAULTS.measurementSelections,
        });
        return;
      case "currency":
        setApp({
          currencyDisplayMode: DEFAULTS.currencyDisplayMode,
          numberScale: DEFAULTS.numberScale,
        });
        return;
      case "language":
        setApp({
          language: DEFAULTS.language,
          formattingLocale: DEFAULTS.formattingLocale,
        });
        return;
      case "accessibility":
        setApp({
          reducedMotion: DEFAULTS.reducedMotion,
          tooltipDetail: DEFAULTS.tooltipDetail,
        });
        return;
    }
  };

  const panels: Readonly<Record<OptionsDepartment, ReactNode>> = {
    general: (
      <div className="space-y-3 text-sm text-admiralty-ink-muted">
        <p>Your settings are stored for this profile and apply across every campaign.</p>
        <p>
          Campaign-specific options live in Campaign preferences. Advanced preferences are managed
          by the campaign and content packs.
        </p>
      </div>
    ),
    appearance: (
      <div className="space-y-5">
        <Field label={translate("settings.theme.label")}>
          <OptionGroup
            label={translate("settings.theme.label")}
            value={theme}
            options={THEME_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.theme.${value}` as MessageKey),
            }))}
            onChange={setTheme}
          />
        </Field>
        <Field label={translate("settings.background.label")}>
          <OptionGroup
            label={translate("settings.background.label")}
            value={background}
            options={BACKGROUND_OPTIONS}
            onChange={setBackground}
          />
        </Field>
        <Field label={translate("settings.font.label")}>
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
        </Field>
        <Field label={translate("settings.density.label")}>
          <OptionGroup
            label={translate("settings.density.label")}
            value={density}
            options={DENSITY_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            onChange={setDensity}
          />
        </Field>
        <Field
          label={
            <>
              {translate("settings.textScale.label")}{" "}
              <span className="font-display tabular-nums text-admiralty-ink-muted">
                {preferences.textScale}%
              </span>
            </>
          }
        >
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
        </Field>
      </div>
    ),
    measurements: (
      <div className="space-y-5">
        <Field label={translate("settings.measurement.preset")}>
          <OptionGroup
            label={translate("settings.measurement.preset")}
            value={preferences.measurementPreset}
            options={MEASUREMENT_PRESETS.map((value) => ({
              value,
              label: translate(`settings.measurement.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ measurementPreset: value })}
          />
        </Field>
        <MeasurementCategorySelects
          preset={preferences.measurementPreset}
          selections={preferences.measurementSelections}
          onChange={(category, unitId) =>
            setApp({
              measurementSelections: { ...preferences.measurementSelections, [category]: unitId },
            })
          }
        />
      </div>
    ),
    currency: (
      <div className="space-y-5">
        <Field label={translate("settings.currency.label")}>
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
        </Field>
        <Field label={translate("settings.numberScale.label")}>
          <OptionGroup
            label={translate("settings.numberScale.label")}
            value={preferences.numberScale}
            options={NUMBER_SCALE_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.numberScale.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ numberScale: value })}
          />
        </Field>
      </div>
    ),
    language: (
      <div className="space-y-5">
        <Field label={translate("settings.language.label")}>
          <OptionGroup
            label={translate("settings.language.label")}
            value={preferences.language}
            options={LANGUAGE_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.language.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ language: value })}
          />
        </Field>
        <Field label={translate("settings.locale.label")}>
          <OptionGroup
            label={translate("settings.locale.label")}
            value={preferences.formattingLocale}
            options={FORMATTING_LOCALES.map((value) => ({
              value,
              label: translate(`settings.locale.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ formattingLocale: value })}
          />
        </Field>
      </div>
    ),
    accessibility: (
      <div className="space-y-5">
        <Field label={translate("settings.reducedMotion.label")}>
          <OptionGroup
            label={translate("settings.reducedMotion.label")}
            value={preferences.reducedMotion}
            options={REDUCED_MOTION_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.reducedMotion.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ reducedMotion: value })}
          />
        </Field>
        <Field label={translate("settings.tooltipDetail.label")}>
          <OptionGroup
            label={translate("settings.tooltipDetail.label")}
            value={preferences.tooltipDetail}
            options={TOOLTIP_DETAIL_PREFERENCES.map((value) => ({
              value,
              label: translate(`settings.tooltipDetail.${value}` as MessageKey),
            }))}
            onChange={(value) => setApp({ tooltipDetail: value })}
          />
        </Field>
        <p className="text-sm text-admiralty-ink-muted">
          The high-contrast theme lives under Appearance.
        </p>
      </div>
    ),
  };

  const tabs = (
    <IndexTabs
      label="Settings departments"
      testId="options-departments"
      groups={optionsIndexTabs({
        theme: translate(`settings.theme.${theme}` as MessageKey),
        measurementPreset: translate(
          `settings.measurement.${preferences.measurementPreset}` as MessageKey,
        ),
        currency: translate(`settings.currency.${currency.effective}` as MessageKey),
        currencyAttention: currency.fallbackReason !== undefined,
        language: translate(`settings.language.${preferences.language}` as MessageKey),
        motion: translate(`settings.reducedMotion.${preferences.reducedMotion}` as MessageKey),
      })}
      openId={department}
      onOpen={(id) => setDepartment(department === id ? null : id)}
      attached={wide}
    />
  );

  const meta = department === null ? null : optionsDepartmentMeta(department);
  const drawer =
    meta === null ? null : (
      <DepartmentDrawer
        title={meta.label}
        summary={meta.summary}
        width="narrow"
        testId="options-workbench"
        onClose={() => setDepartment(null)}
      >
        {panels[meta.id]}
        <div className="mt-6 border-t border-admiralty-border pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => resetDepartment(meta.id)}>
            {meta.id === "general"
              ? translate("settings.reset.all")
              : translate("settings.reset.department", {
                  department: translate(`settings.reset.noun.${meta.id}` as MessageKey),
                })}
          </Button>
        </div>
      </DepartmentDrawer>
    );

  if (wide) {
    return (
      <div className="flex min-h-full flex-col gap-4">
        <PageHeader
          icon={Settings}
          title={translate("settings.title")}
          description={translate("settings.description")}
        />
        <div className="flex items-start justify-end gap-3">
          {drawer !== null && (
            <div className="h-[calc(100dvh-var(--chrome-top,0px)-var(--chrome-bottom,0px)-11rem)] min-h-[20rem]">
              {drawer}
            </div>
          )}
          {tabs}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Settings}
        title={translate("settings.title")}
        description={translate("settings.description")}
      />
      {tabs}
      {drawer !== null && <div className="h-[70vh] min-h-[22rem]">{drawer}</div>}
    </div>
  );
}
