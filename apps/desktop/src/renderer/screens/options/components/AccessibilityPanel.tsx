import { Button } from "../../../components/ui/button.js";
import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import {
  REDUCED_MOTION_PREFERENCES,
  TOOLTIP_DETAIL_PREFERENCES,
} from "../../../../shared/preferences-contract.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../../lib/strings.js";
import { choicesFrom, OptionGroup } from "./OptionGroup.js";

export function AccessibilityPanel({ onOpenAppearance }: { onOpenAppearance: () => void }) {
  const { preferences, setApp } = usePreferences();
  return (
    <SettingsSection title={translate("settings.group.motion")}>
      <SettingsRow
        title={translate("settings.reducedMotion.label")}
        description={translate("settings.reducedMotion.description")}
        control={
          <OptionGroup
            label={translate("settings.reducedMotion.label")}
            value={preferences.reducedMotion}
            options={choicesFrom(REDUCED_MOTION_PREFERENCES, (value) =>
              translate(`settings.reducedMotion.${value}` as MessageKey),
            )}
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
            options={choicesFrom(TOOLTIP_DETAIL_PREFERENCES, (value) =>
              translate(`settings.tooltipDetail.${value}` as MessageKey),
            )}
            onChange={(value) => setApp({ tooltipDetail: value })}
          />
        }
      />
      <SettingsRow
        title={translate("settings.contrast.title")}
        description={translate("settings.contrast.description")}
        control={
          <Button type="button" variant="outline" onClick={onOpenAppearance}>
            {translate("settings.contrast.open")}
          </Button>
        }
      />
    </SettingsSection>
  );
}
