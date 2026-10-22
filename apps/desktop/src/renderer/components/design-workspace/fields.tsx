import { useId, type ReactNode } from "react";
import {
  NumberField as NumberFieldBase,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../ui/number-field.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";
import { FieldError } from "../ui/field.js";
import { cn } from "../../lib/utils.js";

export function normalizeDecimalMark(raw: string): string {
  const t = raw.trim();
  if (t.includes(".") || !t.includes(",")) return raw;
  const first = t.indexOf(",");
  if (t.indexOf(",", first + 1) !== -1) return raw;
  return `${t.slice(0, first)}.${t.slice(first + 1)}`;
}

export function NumberField({
  label,
  value,
  scale = 1,
  decimals = 0,
  min,
  max,
  step,
  unit,
  recommended,
  onCommit,
  className,
  shortLabel,
  error,
}: {
  readonly label: string;
  readonly shortLabel?: string;
  readonly value: number;
  readonly scale?: number;
  readonly decimals?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly recommended?: number;
  readonly onCommit: (internal: number) => void;
  readonly className?: string;
  readonly error?: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const shown = value / scale;
  const stepBy = step ?? (decimals > 0 ? Number((1 / 10 ** decimals).toFixed(decimals)) : 1);
  const clampShown = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const accessibleName = `${label}${unit ? ` (${unit})` : ""}`;
  const resetValue =
    recommended === undefined ? null : Math.round(clampShown(recommended / scale) * scale);
  const showReset = resetValue !== null && recommended !== value;
  return (
    <div className={cn("flex h-full flex-col gap-1", className)}>
      <div className="flex flex-1 items-start justify-between gap-2">
        <label htmlFor={id} className="block text-xs leading-snug text-muted-foreground">
          {shortLabel ?? label}
          {unit ? ` (${unit})` : ""}
        </label>
        {showReset && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            aria-label={`Reset ${label} to recommended`}
            onClick={() => resetValue !== null && onCommit(resetValue)}
          >
            Reset
          </button>
        )}
      </div>
      <NumberFieldBase
        id={id}
        value={shown}
        min={min}
        max={max}
        step={stepBy}
        locale="en-US"
        allowWheelScrub
        format={{
          useGrouping: false,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }}
        onValueCommitted={(next) => {
          if (next === null) return;
          const internal = Math.round(clampShown(next) * scale);
          if (internal !== value) onCommit(internal);
        }}
      >
        <NumberFieldGroup aria-invalid={error ? true : undefined}>
          <NumberFieldDecrement />
          <NumberFieldInput
            aria-label={accessibleName}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChangeCapture={(e) => {
              const raw = e.currentTarget.value;
              const normalized = normalizeDecimalMark(raw);
              if (normalized !== raw) e.currentTarget.value = normalized;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberFieldBase>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function SelectField({
  label,
  shortLabel,
  value,
  options,
  onChange,
  onActiveValueChange,
  className,
  inline = false,
  error,
}: {
  readonly label: string;
  readonly shortLabel?: string;
  readonly inline?: boolean;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly icon?: ReactNode;
    readonly description?: ReactNode;
    readonly disabled?: boolean;
  }[];
  readonly onChange: (value: string) => void;
  readonly onActiveValueChange?: (value: string | null) => void;
  readonly className?: string;
  readonly error?: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div
      className={cn(inline ? "flex items-center gap-2" : "flex h-full flex-col gap-1", className)}
    >
      <label
        htmlFor={id}
        className={cn(
          "text-xs leading-snug text-muted-foreground",
          inline ? "shrink-0" : "block flex-1",
        )}
      >
        {shortLabel ?? label}
      </label>
      <Select
        value={value}
        onValueChange={onChange}
        onActiveValueChange={onActiveValueChange}
        className="w-full"
      >
        <SelectTrigger
          id={id}
          aria-label={shortLabel === undefined ? undefined : label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(inline && "h-9 py-0", error && "border-destructive")}
        >
          <SelectValue placeholder="Select" className="min-w-0 flex-1 truncate text-left" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              icon={o.icon}
              description={o.description}
              disabled={o.disabled}
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
