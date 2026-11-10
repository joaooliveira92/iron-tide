import type { LucideIcon } from "lucide-react";

import { Button } from "../../../components/ui/button.js";

export interface OptionGroupChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
}

export function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly OptionGroupChoice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap justify-end gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant={option.value === value ? "default" : "outline"}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {Icon !== undefined ? <Icon aria-hidden="true" /> : null}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export function choicesFrom<T extends string>(
  values: readonly T[],
  label: (value: T) => string,
): readonly OptionGroupChoice<T>[] {
  return values.map((value) => ({ value, label: label(value) }));
}
