import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import { MEASUREMENT_PRESETS } from "../../../../shared/preferences-contract.js";
import {
  MEASUREMENT_CATEGORIES,
  defaultDisplayUnit,
  displayUnitsForCategory,
} from "../../../lib/presentation-format/units.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../../lib/strings.js";
import { choicesFrom, OptionGroup } from "./OptionGroup.js";

const SELECT_CLASS = "h-8 min-w-0 rounded-md border bg-background px-2 text-sm";

export function MeasurementsPanel() {
  const { preferences, setApp } = usePreferences();
  const { measurementPreset: preset, measurementSelections: selections } = preferences;
  return (
    <>
      <SettingsSection title={translate("settings.group.preset")}>
        <SettingsRow
          title={translate("settings.measurement.preset")}
          description={translate("settings.measurement.presetDescription")}
          control={
            <OptionGroup
              label={translate("settings.measurement.preset")}
              value={preset}
              options={choicesFrom(MEASUREMENT_PRESETS, (value) =>
                translate(`settings.measurement.${value}` as MessageKey),
              )}
              onChange={(value) => setApp({ measurementPreset: value })}
            />
          }
        />
      </SettingsSection>
      <SettingsSection title={translate("settings.group.units")}>
        {MEASUREMENT_CATEGORIES.map((category) => {
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
                  onChange={(event) =>
                    setApp({
                      measurementSelections: { ...selections, [category]: event.target.value },
                    })
                  }
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
        })}
      </SettingsSection>
    </>
  );
}
