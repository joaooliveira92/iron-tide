import { memo } from "react";
import type { NewGameScenario } from "../../../../shared/new-game-contract.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Field, FieldGroup, FieldLabel } from "../../../components/ui/field.js";
import { Input } from "../../../components/ui/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import {
  FLEET_SIZE_FIELD_LABEL,
  fleetSizeLabel,
  fleetSizeReadout,
  scenarioEraDescription,
} from "../rules-of-the-naval-age-content.js";
import { fleetSizeIcon, ScenarioEraIcon } from "./option-icons.js";

export interface EraScaleSectionProps {
  readonly scenarioId: string;
  readonly campaignSeed: string;
  readonly fleetSize: string;
  readonly scenarios: readonly NewGameScenario[];
  readonly fleetSizeOptions: readonly string[];
  readonly onScenarioChange: (id: string) => void;
  readonly onFleetSizeChange: (value: string) => void;
  readonly onSeedChange: (seed: string) => void;
}

export const EraScaleSection = memo(function EraScaleSection({
  scenarioId,
  campaignSeed,
  fleetSize,
  scenarios,
  fleetSizeOptions,
  onScenarioChange,
  onFleetSizeChange,
  onSeedChange,
}: EraScaleSectionProps) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Era &amp; Scale</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="scenario">Starting Era</FieldLabel>
            <Select value={scenarioId} onValueChange={onScenarioChange} className="w-full">
              <SelectTrigger id="scenario">
                <SelectValue placeholder="Select an era" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    icon={<ScenarioEraIcon aria-hidden="true" className="size-4" />}
                    description={scenarioEraDescription(option)}
                  >
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="fleetSize">{FLEET_SIZE_FIELD_LABEL}</FieldLabel>
            <Select
              value={fleetSize}
              onValueChange={onFleetSizeChange}
              className="w-full"
              disabled={fleetSizeOptions.length <= 1}
            >
              <SelectTrigger id="fleetSize">
                <SelectValue placeholder="Select fleet size" />
              </SelectTrigger>
              <SelectContent>
                {fleetSizeOptions.map((option) => {
                  const Icon = fleetSizeIcon(option);
                  return (
                    <SelectItem
                      key={option}
                      value={option}
                      icon={<Icon aria-hidden="true" className="size-4" />}
                      description={fleetSizeReadout(option)}
                    >
                      {fleetSizeLabel(option)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="campaignSeed">Campaign Seed</FieldLabel>
            <Input
              id="campaignSeed"
              name="campaignSeed"
              value={campaignSeed}
              onChange={(event) => onSeedChange(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              inputMode="none"
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </GlassCard>
  );
});
