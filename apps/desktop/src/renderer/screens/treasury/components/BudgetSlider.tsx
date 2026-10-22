import type { BudgetKnob } from "../budget-policy-view-model.js";

export interface BudgetSliderProps {
  readonly knob: BudgetKnob;
  readonly onChange: (value: number) => void;
}

export function BudgetSlider({ knob, onChange }: BudgetSliderProps) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="flex justify-between">
        <span>{knob.label}</span>
        <span className="tabular-nums">{knob.display}</span>
      </span>
      <input
        type="range"
        aria-label={knob.ariaLabel}
        className="w-full"
        min={knob.min}
        max={knob.max}
        step={knob.step}
        value={knob.value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
