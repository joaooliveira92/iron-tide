import { Toggle } from "../../../components/ui/toggle.js";
import { cn } from "../../../lib/utils.js";
import { WEIGHT_OPTIONS, type FieldWeightOption } from "../research-field-priorities.js";
import { Tip } from "../../../components/ui/tip.js";

export interface WeightControlProps {
  readonly label: string;
  readonly weight: number;
  readonly highBlocked: boolean;
  readonly highCap: number;
  readonly disabled: boolean;
  readonly compact?: boolean;
  readonly onSetWeight: (weight: FieldWeightOption) => void;
}

export function WeightControl({
  label,
  weight,
  highBlocked,
  highCap,
  disabled,
  compact = false,
  onSetWeight,
}: WeightControlProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center rounded-md bg-muted p-0.5", compact ? "gap-0" : "gap-0.5")}
    >
      {WEIGHT_OPTIONS.map((option) => {
        const blocked = option.isHigh && highBlocked && weight !== option.weight;
        return (
          <Tip
            key={option.label}
            label={
              blocked
                ? `At most ${highCap} fields may be High — lower another High field first`
                : `${option.label} priority`
            }
          >
            <Toggle
              pressed={weight === option.weight}
              onPressedChange={() => onSetWeight(option.weight)}
              disabled={disabled || blocked}
              size="sm"
              aria-label={`${label} ${option.label}`}

              className={cn(
                "data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm",
                compact ? "h-6 min-w-6 px-1 text-[0.6875rem]" : "min-w-12",
                option.isHigh && "data-pressed:text-primary",
              )}
            >
              {compact ? option.label.charAt(0) : option.label}
            </Toggle>
          </Tip>
        );
      })}
    </div>
  );
}
