import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import { translate } from "../../../lib/strings.js";

export function GeneralPanel() {
  return (
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
  );
}
