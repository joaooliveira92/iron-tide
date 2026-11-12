import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import {
  CURRENCY_DISPLAY_MODES,
  NUMBER_SCALE_PREFERENCES,
} from "../../../../shared/preferences-contract.js";
import { formatMoney } from "../../../lib/presentation-format/money.js";
import { useCurrencyDisplayMode, usePreferences } from "../../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../../lib/strings.js";
import { useActiveCampaignCurrencyContext } from "../../../shell/CampaignShellContext.js";
import { choicesFrom, OptionGroup } from "./OptionGroup.js";

export function CurrencyPanel() {
  const { preferences, setApp } = usePreferences();
  const currencyContext = useActiveCampaignCurrencyContext();
  const currency = useCurrencyDisplayMode(currencyContext);
  const currencyReason =
    currency.fallbackReason === undefined
      ? undefined
      : translate(`settings.currency.unavailable.${currency.fallbackReason}` as MessageKey);
  const nationalAvailable =
    currency.requested === "nationalHistorical" && currencyReason === undefined;

  return (
    <SettingsSection title={translate("settings.group.money")}>
      <SettingsRow
        title={translate("settings.currency.label")}
        description={translate("settings.currency.description")}
        control={
          <OptionGroup
            label={translate("settings.currency.label")}
            value={currency.requested}
            options={choicesFrom(CURRENCY_DISPLAY_MODES, (value) =>
              translate(`settings.currency.${value}` as MessageKey),
            )}
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
            options={choicesFrom(NUMBER_SCALE_PREFERENCES, (value) =>
              translate(`settings.numberScale.${value}` as MessageKey),
            )}
            onChange={(value) => setApp({ numberScale: value })}
          />
        }
      />
    </SettingsSection>
  );
}
