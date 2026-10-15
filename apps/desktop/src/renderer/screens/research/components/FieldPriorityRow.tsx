import { Toggle } from "../../../components/ui/toggle.js";
import { WEIGHT_OPTIONS, type FieldWeightOption } from "../research-field-priorities.js";
import type { ResearchFieldRow } from "../research-view-model.js";

export interface FieldPriorityRowProps {
  readonly field: ResearchFieldRow;
  /** True when no additional field may be raised to High (the INC-5 cap). */
  readonly highCapReached: boolean;
  /** The engine's maximum number of High fields, for the affordance copy. */
  readonly highCap: number;
  readonly busy: boolean;
  readonly onSetWeight: (weight: FieldWeightOption) => void;
}

/**
 * One canonical research field: its label, projected next-month points, and the
 * High/Med/Low weight picker. Purely presentational — the parent owns the draft
 * and the cap decision.
 */
export function FieldPriorityRow({
  field,
  highCapReached,
  highCap,
  busy,
  onSetWeight,
}: FieldPriorityRowProps) {
  const wouldExceedHighCap = !field.isHigh && highCapReached;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm">{field.label}</span>
        <span className="text-xs text-muted-foreground">
          ~{field.projectedPoints.toLocaleString()} pts next month
        </span>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label={field.label}>
        {WEIGHT_OPTIONS.map((option) => {
          const exceedsHighCap = option.isHigh && wouldExceedHighCap;
          return (
            <Toggle
              key={option.label}
              pressed={field.weight === option.weight}
              onPressedChange={() => onSetWeight(option.weight)}
              disabled={busy || exceedsHighCap}
              size="sm"
              aria-label={`${field.label} ${option.label}`}
              title={
                exceedsHighCap
                  ? `At most ${highCap} fields may be High — lower another High field first`
                  : undefined
              }
            >
              {option.label}
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}
