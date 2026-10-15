import { memo } from "react";
import { Eye, Sparkles } from "lucide-react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Field, FieldDescription, FieldLabel } from "../../../components/ui/field.js";
import { Toggle } from "../../../components/ui/toggle.js";
import type { DisplayPreferences } from "../types.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";

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
    <GlassCard>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Display Preferences
        </CardTitle>
        <CardDescription>Local settings for how information is presented.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {DISPLAY_PREFERENCE_OPTIONS.map(({ key, label, description }) => (
          <Field
            key={key}
            orientation="horizontal"
            className="justify-between rounded-md px-3 py-2 hover:bg-muted/20"
          >
            <div className="space-y-0.5">
              <FieldLabel className="text-sm">{label}</FieldLabel>
              <FieldDescription>{description}</FieldDescription>
            </div>
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
          </Field>
        ))}
      </CardContent>
    </GlassCard>
  );
});
