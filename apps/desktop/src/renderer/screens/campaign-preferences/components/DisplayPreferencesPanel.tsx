import { memo } from "react";
import { Sparkles } from "lucide-react";
import { Toggle } from "../../../components/ui/toggle.js";
import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import type { DisplayPreferences } from "../types.js";

interface DisplayPreferenceOption {
  readonly key: keyof DisplayPreferences;
  readonly label: string;
  readonly description: string;
}

const DISPLAY_PREFERENCE_OPTIONS: readonly DisplayPreferenceOption[] = [
  {
    key: "showDetailedTooltips",
    label: "Detailed Tooltips",
    description: "Expanded stat breakdowns on hover.",
  },
  {
    key: "confirmBeforeTurn",
    label: "Confirm Before Turn",
    description: "Confirm before advancing the month.",
  },
  {
    key: "showUnitFatigue",
    label: "Show Unit Fatigue",
    description: "Fatigue and readiness indicators.",
  },
  {
    key: "showSupplyOverlay",
    label: "Supply Overlay",
    description: "Supply-range heatmap on the map.",
  },
];

export interface DisplayPreferencesPanelProps {
  readonly displayPrefs: DisplayPreferences;
  readonly onTogglePref: (key: keyof DisplayPreferences) => void;
}

export const DisplayPreferencesPanel = memo(function DisplayPreferencesPanel({
  displayPrefs,
  onTogglePref,
}: DisplayPreferencesPanelProps) {
  return (
    <SettingsSection
      title="Display"
      description="Stored locally. They do not affect other players."
    >
      {DISPLAY_PREFERENCE_OPTIONS.map(({ key, label, description }) => (
        <SettingsRow
          key={key}
          title={label}
          description={description}
          control={
            <Toggle
              pressed={displayPrefs[key]}
              onPressedChange={() => onTogglePref(key)}
              size="sm"
              variant="outline"
              className="shrink-0 data-pressed:bg-primary data-pressed:text-primary-foreground"
              aria-label={`Toggle ${label}`}
            >
              <Sparkles className="h-3 w-3" />
            </Toggle>
          }
        />
      ))}
    </SettingsSection>
  );
});
