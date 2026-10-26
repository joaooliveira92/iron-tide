import { useRef, type KeyboardEvent } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { Hourglass } from "lucide-react";
import { Kbd } from "../../../components/ui/kbd.js";
import { cn } from "../../../lib/utils.js";
import type { FieldWeightOption } from "../research-field-priorities.js";
import { WEIGHT_OPTIONS } from "../research-field-priorities.js";
import type { ResearchFieldView } from "../research-view-model.js";
import { fieldIcon } from "./field-icons.js";
import { FieldSummary } from "./FieldSummary.js";
import { WeightControl } from "./WeightControl.js";

export interface FieldMapProps {
  readonly fields: readonly ResearchFieldView[];
  readonly selectedFieldId: string;
  readonly highCapReached: boolean;
  readonly highCap: number;
  readonly busy: boolean;
  readonly onSelect: (fieldId: string) => void;
  readonly onSetWeight: (fieldId: string, weight: FieldWeightOption) => void;
}

const WEIGHT_RAIL: Readonly<Record<string, string>> = {
  High: "bg-primary",
  Medium: "bg-primary/50",
  Low: "bg-border",
};

const KEY_WEIGHT = new Map(WEIGHT_OPTIONS.map((o) => [o.label.charAt(0).toLowerCase(), o.weight]));

export function FieldMap({
  fields,
  selectedFieldId,
  highCapReached,
  highCap,
  busy,
  onSelect,
  onSetWeight,
}: FieldMapProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const index = fields.findIndex((f) => f.fieldId === selectedFieldId);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = fields[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (next === undefined) return;
      onSelect(next.fieldId);
      listRef.current?.querySelector<HTMLElement>(`[data-field-row="${next.fieldId}"]`)?.focus();
      return;
    }
    const weight = KEY_WEIGHT.get(event.key.toLowerCase());
    if (weight !== undefined && !busy && event.target instanceof HTMLElement) {
      if (event.target.closest("[data-field-row]") === null) return;
      event.preventDefault();
      onSetWeight(selectedFieldId, weight);
    }
  };

  return (
    <nav aria-label="Research fields" className="flex h-full min-h-0 flex-col border-r">
      <ul
        ref={listRef}
        onKeyDown={onKeyDown}
        className="themed-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5 xl:p-2"
      >
        {fields.map((field) => {
          const Icon = fieldIcon(field.fieldId);
          const active = field.fieldId === selectedFieldId;
          const muted = field.state === "waiting" || field.state === "empty";
          return (
            <li key={field.fieldId} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-1.5 left-0 w-0.5 rounded-full",
                  WEIGHT_RAIL[field.weightLabel],
                )}
              />
              <div
                data-active={active}
                className={cn(
                  "group/row flex items-center gap-1 rounded-md pr-1 pl-1.5",
                  "hover:bg-accent/60 data-[active=true]:bg-accent",
                )}
              >
                <HoverCard>
                  <HoverCardTrigger
                    delay={250}
                    render={
                      <button
                        type="button"
                        data-field-row={field.fieldId}
                        aria-current={active ? "true" : undefined}
                        aria-keyshortcuts="H M L"
                        aria-label={`${field.label}, ${field.weightLabel} priority, ${field.discoveredTechs} of ${field.totalTechs} discovered`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onSelect(field.fieldId)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-left text-sm outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ring max-xl:justify-center",
                          active && "font-medium",
                          muted && !active && "text-muted-foreground",
                        )}
                      />
                    }
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate max-xl:sr-only">{field.label}</span>
                    {field.state === "waiting" && (
                      <Hourglass
                        aria-hidden="true"
                        className="size-3 shrink-0 text-muted-foreground max-xl:hidden"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "text-xs text-muted-foreground tabular-nums max-xl:sr-only",
                        "xl:group-hover/row:hidden xl:group-focus-within/row:hidden xl:group-data-[active=true]/row:hidden",
                      )}
                    >
                      {field.projectedPoints > 0
                        ? `+${field.projectedPoints}`
                        : `${field.discoveredTechs}/${field.totalTechs}`}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" align="start" sideOffset={8} className="w-64">
                    <FieldSummary field={field} />
                  </HoverCardContent>
                </HoverCard>
                <div className="hidden xl:group-hover/row:block xl:group-focus-within/row:block xl:group-data-[active=true]/row:block">
                  <WeightControl
                    label={`${field.label} quick priority`}
                    weight={field.weight}
                    highBlocked={highCapReached}
                    highCap={highCap}
                    disabled={busy}
                    compact
                    onSetWeight={(weight) => onSetWeight(field.fieldId, weight)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 text-xs whitespace-nowrap text-muted-foreground max-xl:hidden">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> browse
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>H</Kbd>
          <Kbd>M</Kbd>
          <Kbd>L</Kbd> priority
        </span>
      </p>
    </nav>
  );
}
