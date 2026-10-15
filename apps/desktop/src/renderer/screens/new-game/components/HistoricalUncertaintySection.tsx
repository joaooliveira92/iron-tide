import { memo } from "react";
import type { SupportedConfigurationValues } from "@bluewave/campaign-engine";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Field, FieldGroup, FieldLabel } from "../../../components/ui/field.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import type { DraftPreferences } from "../new-game-preferences-screen-state.js";
import {
  UNCERTAINTY_FIELD_LABELS,
  UNCERTAINTY_FIELDS,
  uncertaintyValueContent,
  type UncertaintyField,
} from "../rules-of-the-naval-age-content.js";
import { uncertaintyFieldIcon } from "./option-icons.js";

export interface HistoricalUncertaintySectionProps {
  readonly preferences: DraftPreferences;
  readonly supportedValues: SupportedConfigurationValues;
  readonly onPreferenceChange: (field: UncertaintyField, value: string) => void;
}

export const HistoricalUncertaintySection = memo(function HistoricalUncertaintySection({
  preferences,
  supportedValues,
  onPreferenceChange,
}: HistoricalUncertaintySectionProps) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Historical Uncertainty</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <FieldGroup className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {UNCERTAINTY_FIELDS.map((field) => {
            const values = supportedValues[field] ?? [];
            const currentValue = preferences[field];
            const Icon = uncertaintyFieldIcon(field);
            return (
              <Field key={field}>
                <FieldLabel htmlFor={field}>{UNCERTAINTY_FIELD_LABELS[field]}</FieldLabel>
                <Select
                  value={currentValue}
                  onValueChange={(value) => onPreferenceChange(field, value)}
                  disabled={values.length <= 1}
                  className="w-full"
                >
                  <SelectTrigger id={field}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {values.map((value) => {
                      const content = uncertaintyValueContent(field, value);
                      return (
                        <SelectItem
                          key={value}
                          value={value}
                          icon={<Icon aria-hidden="true" className="size-4" />}
                          description={content.blurb}
                        >
                          {content.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            );
          })}
        </FieldGroup>
      </CardContent>
    </GlassCard>
  );
});
