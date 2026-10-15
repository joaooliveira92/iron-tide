import {
  Anchor,
  LockKeyhole,
  PenLine,
  RotateCcw,
  Ruler,
  RulerDimensionLine,
  ScrollText,
  Wand2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field.js";
import { GlassCard } from "../../components/ui/glass-card.js";
import { Input } from "../../components/ui/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  type CampaignIdentityDraft,
  type MeasurementSystem,
  type NamingConvention,
  type ShipNameReuse,
  isCampaignIdentityValid,
  MEASUREMENT_SYSTEM_OPTIONS,
  NAMING_CONVENTION_OPTIONS,
  SHIP_NAME_REUSE_OPTIONS,
  updateCampaignIdentity,
} from "./new-game-identity-screen-state.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";

const NAMING_CONVENTION_ICONS = {
  historical: <ScrollText className="h-4 w-4" />,
  generated: <Wand2 className="h-4 w-4" />,
  custom: <PenLine className="h-4 w-4" />,
} as const;

const SHIP_NAME_REUSE_ICONS = {
  disabled: <LockKeyhole className="h-4 w-4" />,
  allowed: <RotateCcw className="h-4 w-4" />,
} as const;

const MEASUREMENT_SYSTEM_ICONS = {
  imperial: <Ruler className="h-4 w-4" />,
  metric: <RulerDimensionLine className="h-4 w-4" />,
} as const;

export interface NewGameIdentityScreenProps {
  readonly initialIdentity: CampaignIdentityDraft;
  readonly onBack: () => void;
  readonly onNext: (identity: CampaignIdentityDraft) => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export function NewGameIdentityScreen({
  initialIdentity,
  onBack,
  onNext,
  onPrimaryActionChange,
}: NewGameIdentityScreenProps) {
  const [identity, setIdentity] = useState<CampaignIdentityDraft>(initialIdentity);

  const identityRef = useRef(identity);
  identityRef.current = identity;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  const triggerNext = useCallback(() => {
    if (isCampaignIdentityValid(identityRef.current)) onNextRef.current(identityRef.current);
  }, []);

  const valid = isCampaignIdentityValid(identity);

  const primaryAction = useMemo(
    () => ({ label: "Next", disabled: !valid, onTrigger: triggerNext }),
    [valid, triggerNext],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  return (
    <NewGameScreenLayout>
      <ScreenHeader
        icon={<Anchor className="h-5 w-5" />}
        title="Admiral & Campaign Identity"
        description="Give this command a name."
      />

      <GlassCard glassVariant="liquid-refract">
        <FieldGroup className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="admiral-name">Admiral name</FieldLabel>
            <Input
              id="admiral-name"
              placeholder="e.g. John Fisher"
              value={identity.admiralName}
              onChange={(event) =>
                setIdentity((current) =>
                  updateCampaignIdentity(current, "admiralName", event.target.value),
                )
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="campaign-name">Campaign name</FieldLabel>
            <Input
              id="campaign-name"
              placeholder="e.g. Britannia Ascendant"
              value={identity.campaignName}
              onChange={(event) =>
                setIdentity((current) =>
                  updateCampaignIdentity(current, "campaignName", event.target.value),
                )
              }
            />
          </Field>
        </FieldGroup>
      </GlassCard>

      <GlassCard glassVariant="liquid-refract">
        <FieldGroup className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="naming-convention">Naming convention</FieldLabel>
            <Select
              value={identity.namingConvention}
              onValueChange={(value) =>
                setIdentity((current) =>
                  updateCampaignIdentity(current, "namingConvention", value as NamingConvention),
                )
              }
              className="w-full"
            >
              <SelectTrigger id="naming-convention">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {NAMING_CONVENTION_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    icon={NAMING_CONVENTION_ICONS[option.value]}
                    description={option.description}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="ship-name-reuse">Ship name reuse</FieldLabel>
            <Select
              value={identity.shipNameReuse}
              onValueChange={(value) =>
                setIdentity((current) =>
                  updateCampaignIdentity(current, "shipNameReuse", value as ShipNameReuse),
                )
              }
              className="w-full"
            >
              <SelectTrigger id="ship-name-reuse">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {SHIP_NAME_REUSE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    icon={SHIP_NAME_REUSE_ICONS[option.value]}
                    description={option.description}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="measurement-system">Measurement system</FieldLabel>
            <Select
              value={identity.measurementSystem}
              onValueChange={(value) =>
                setIdentity((current) =>
                  updateCampaignIdentity(current, "measurementSystem", value as MeasurementSystem),
                )
              }
              className="w-full"
            >
              <SelectTrigger id="measurement-system">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {MEASUREMENT_SYSTEM_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    icon={MEASUREMENT_SYSTEM_ICONS[option.value]}
                    description={option.description}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </GlassCard>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to Archetype
        </Button>
      </div>
    </NewGameScreenLayout>
  );
}
