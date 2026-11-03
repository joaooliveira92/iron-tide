import {
  AudioWaveform,
  Ban,
  Citrus,
  Flame,
  Gem,
  Orbit,
  Settings,
  Undo2,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { PageHeader } from "../../components/shared/PageHeader.js";
import {
  SettingsModal,
  SettingsRow,
  SettingsSection,
} from "../../components/shared/SettingsModal.js";
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
import {
  OPTIONS_DEPARTMENT_ORDER,
  optionsDepartmentMeta,
  type OptionsDepartment,
} from "./options-departments.js";

const DEFAULTS = DEFAULT_APP_PREFERENCES;
const TEXT_SCALE_STEP = 5;

const SELECT_CLASS = "h-8 min-w-0 rounded-md border bg-background px-2 text-sm";

const NAV_ITEMS = OPTIONS_DEPARTMENT_ORDER.map(optionsDepartmentMeta);

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
    <div role="group" aria-label={label} className="flex flex-wrap justify-end gap-2">
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

function MeasurementCategoryRows({
  preset,
  selections,
  onChange,
}: {
  preset: AppPreferences["measurementPreset"];
  selections: AppPreferences["measurementSelections"];
  onChange: (category: string, unitId: string) => void;
}) {
  return MEASUREMENT_CATEGORIES.map((category) => {
    const label = translate(`settings.measurement.category.${category}` as MessageKey);
    const current = selections[category] ?? defaultDisplayUnit(category, preset).id;
    return (
      <SettingsRow
        key={category}
        title={label}
        control={
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
        }
      />
    );
  });
}

export interface OptionsScreenProps {
  readonly onClose?: () => void;
}

export function OptionsScreen({ onClose }: OptionsScreenProps = {}) {
  const { background, setBackground } = useBackground();
  const { density, setDensity } = useDensity();
  const { font, setFont } = useFont();
  const { theme, setTheme } = useTheme();
  const { preferences, setApp } = usePreferences();
  const currencyContext = useActiveCampaignCurrencyContext();
  const currency = useCurrencyDisplayMode(currencyContext);
  const [open, setOpen] = useState(true);
  const [department, setDepartment] = useState<OptionsDepartment>("general");

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
      <SettingsSection title={translate("settings.group.storage")}>
        <SettingsRow
          title={translate("settings.row.profile.title")}
          description={translate("settings.row.profile.description")}
        />
        <SettingsRow
          title={translate("settings.row.campaign.title")}
          description={translate("settings.row.campaign.description")}
        />
      </SettingsSection>
    ),
    appearance: (
      <>
        <SettingsSection title={translate("settings.group.themeBackground")}>
          <SettingsRow
            title={translate("settings.theme.label")}
            description={translate("settings.theme.description")}
            control={
              <OptionGroup
                label={translate("settings.theme.label")}
                value={theme}
                options={THEME_PREFERENCES.map((value) => ({
                  value,
                  label: translate(`settings.theme.${value}` as MessageKey),
                }))}
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
            control={
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
            }
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
            control={
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
            }
          />
        </SettingsSection>
      </>
    ),
    measurements: (
      <>
        <SettingsSection title={translate("settings.group.preset")}>
          <SettingsRow
            title={translate("settings.measurement.preset")}
            description={translate("settings.measurement.presetDescription")}
            control={
              <OptionGroup
                label={translate("settings.measurement.preset")}
                value={preferences.measurementPreset}
                options={MEASUREMENT_PRESETS.map((value) => ({
                  value,
                  label: translate(`settings.measurement.${value}` as MessageKey),
                }))}
                onChange={(value) => setApp({ measurementPreset: value })}
              />
            }
          />
        </SettingsSection>
        <SettingsSection title={translate("settings.group.units")}>
          <MeasurementCategoryRows
            preset={preferences.measurementPreset}
            selections={preferences.measurementSelections}
            onChange={(category, unitId) =>
              setApp({
                measurementSelections: { ...preferences.measurementSelections, [category]: unitId },
              })
            }
          />
        </SettingsSection>
      </>
    ),
    currency: (
      <SettingsSection title={translate("settings.group.money")}>
        <SettingsRow
          title={translate("settings.currency.label")}
          description={translate("settings.currency.description")}
          control={
            <OptionGroup
              label={translate("settings.currency.label")}
              value={currency.requested}
              options={CURRENCY_DISPLAY_MODES.map((value) => ({
                value,
                label: translate(`settings.currency.${value}` as MessageKey),
              }))}
              onChange={currency.setRequested}
            />
          }
        >
          <p className="text-xs text-muted-foreground" role="status">
            {nationalAvailable
              ? `${translate("settings.currency.nationalHistorical")}: ${formatMoney(12_000, {
                  locale: preferences.formattingLocale,
                  mode: currency.effective,
                })}`
              : (currencyReason ?? "")}
          </p>
        </SettingsRow>
        <SettingsRow
          title={translate("settings.numberScale.label")}
          description={translate("settings.numberScale.description")}
          control={
            <OptionGroup
              label={translate("settings.numberScale.label")}
              value={preferences.numberScale}
              options={NUMBER_SCALE_PREFERENCES.map((value) => ({
                value,
                label: translate(`settings.numberScale.${value}` as MessageKey),
              }))}
              onChange={(value) => setApp({ numberScale: value })}
            />
          }
        />
      </SettingsSection>
    ),
    language: (
      <SettingsSection title={translate("settings.group.language")}>
        <SettingsRow
          title={translate("settings.language.label")}
          description={translate("settings.language.description")}
          control={
            <OptionGroup
              label={translate("settings.language.label")}
              value={preferences.language}
              options={LANGUAGE_PREFERENCES.map((value) => ({
                value,
                label: translate(`settings.language.${value}` as MessageKey),
              }))}
              onChange={(value) => setApp({ language: value })}
            />
          }
        />
        <SettingsRow
          title={translate("settings.locale.label")}
          description={translate("settings.locale.description")}
          control={
            <OptionGroup
              label={translate("settings.locale.label")}
              value={preferences.formattingLocale}
              options={FORMATTING_LOCALES.map((value) => ({
                value,
                label: translate(`settings.locale.${value}` as MessageKey),
              }))}
              onChange={(value) => setApp({ formattingLocale: value })}
            />
          }
        />
      </SettingsSection>
    ),
    accessibility: (
      <SettingsSection title={translate("settings.group.motion")}>
        <SettingsRow
          title={translate("settings.reducedMotion.label")}
          description={translate("settings.reducedMotion.description")}
          control={
            <OptionGroup
              label={translate("settings.reducedMotion.label")}
              value={preferences.reducedMotion}
              options={REDUCED_MOTION_PREFERENCES.map((value) => ({
                value,
                label: translate(`settings.reducedMotion.${value}` as MessageKey),
              }))}
              onChange={(value) => setApp({ reducedMotion: value })}
            />
          }
        />
        <SettingsRow
          title={translate("settings.tooltipDetail.label")}
          description={translate("settings.tooltipDetail.description")}
          control={
            <OptionGroup
              label={translate("settings.tooltipDetail.label")}
              value={preferences.tooltipDetail}
              options={TOOLTIP_DETAIL_PREFERENCES.map((value) => ({
                value,
                label: translate(`settings.tooltipDetail.${value}` as MessageKey),
              }))}
              onChange={(value) => setApp({ tooltipDetail: value })}
            />
          }
        />
        <SettingsRow
          title={translate("settings.contrast.title")}
          description={translate("settings.contrast.description")}
          control={
            <Button type="button" variant="outline" onClick={() => setDepartment("appearance")}>
              {translate("settings.contrast.open")}
            </Button>
          }
        />
      </SettingsSection>
    ),
  };

  const meta = optionsDepartmentMeta(department);
  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Settings}
        title={translate("settings.title")}
        description={translate("settings.description")}
      />
      {!open && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {translate("settings.open")}
        </Button>
      )}
      <SettingsModal
        open={open}
        onOpenChange={(next) => !next && close()}
        title={translate("settings.modal.title")}
        navLabel={translate("settings.modal.nav")}
        items={NAV_ITEMS}
        activeId={department}
        onSelect={setDepartment}
        testId="options-workbench"
        headerAction={
          <Button type="button" variant="ghost" size="sm" onClick={() => resetDepartment(meta.id)}>
            <Undo2 aria-hidden="true" />
            {meta.id === "general"
              ? translate("settings.reset.all")
              : translate("settings.reset.department", {
                  department: translate(`settings.reset.noun.${meta.id}` as MessageKey),
                })}
          </Button>
        }
      >
        {panels[meta.id]}
      </SettingsModal>
    </div>
  );
}
