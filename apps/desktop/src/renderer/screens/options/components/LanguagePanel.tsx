import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import {
  FORMATTING_LOCALES,
  LANGUAGE_PREFERENCES,
} from "../../../../shared/preferences-contract.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../../lib/strings.js";
import { choicesFrom, OptionGroup } from "./OptionGroup.js";

export function LanguagePanel() {
  const { preferences, setApp } = usePreferences();
  return (
    <SettingsSection title={translate("settings.group.language")}>
      <SettingsRow
        title={translate("settings.language.label")}
        description={translate("settings.language.description")}
        control={
          <OptionGroup
            label={translate("settings.language.label")}
            value={preferences.language}
            options={choicesFrom(LANGUAGE_PREFERENCES, (value) =>
              translate(`settings.language.${value}` as MessageKey),
            )}
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
            options={choicesFrom(FORMATTING_LOCALES, (value) =>
              translate(`settings.locale.${value}` as MessageKey),
            )}
            onChange={(value) => setApp({ formattingLocale: value })}
          />
        }
      />
    </SettingsSection>
  );
}
