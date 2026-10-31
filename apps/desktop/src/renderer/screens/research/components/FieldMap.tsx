import { useRef, type KeyboardEvent } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { Hourglass } from "lucide-react";
import { Progress } from "../../../components/ui/progress.js";
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
    <div className="flex h-full min-h-0 flex-col">
      <ul
        ref={listRef}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-px px-1.5 py-2"
      >
        {fields.map((field) => {
          const Icon = fieldIcon(field.fieldId);
          const active = field.fieldId === selectedFieldId;
          const muted = field.state === "waiting" || field.state === "empty";
          const showProgress = field.activeTech !== null && field.activeTech.progressPct > 0;
          return (
            <li key={field.fieldId}>
              <div
                data-active={active}
                className={cn(
                  "group/row relative rounded-md transition-colors",
                  "hover:bg-accent/50 data-[active=true]:bg-accent",
                  "focus-within:ring-2 focus-within:ring-ring",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
                    active
                      ? WEIGHT_RAIL[field.weightLabel]
                      : "bg-transparent group-hover/row:bg-border",
                  )}
                />
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
                        className="flex w-full items-start gap-2 px-2.5 py-2 text-left outline-none"
                      />
                    }
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm leading-tight font-medium truncate",
                            muted && !active && "text-muted-foreground",
                          )}
                        >
                          {field.label}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {field.projectedPoints > 0
                            ? `+${field.projectedPoints} pts`
                            : field.state === "complete"
                              ? `${field.discoveredTechs}/${field.totalTechs}`
                              : field.state === "waiting"
                                ? "idle"
                                : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[0.6875rem] text-muted-foreground">
                          {field.stateNote}
                        </span>
                        {field.state === "waiting" && (
                          <Hourglass
                            aria-hidden="true"
                            className="size-3 shrink-0 text-muted-foreground"
                          />
                        )}
                      </div>
                      {showProgress && (
                        <Progress
                          value={field.activeTech!.progressPct}
                          aria-label={`${field.activeTech!.label} progress`}
                          className="h-1"
                        />
                      )}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" align="start" sideOffset={8} className="w-64">
                    <FieldSummary field={field} />
                  </HoverCardContent>
                </HoverCard>
                <div className="absolute right-1.5 top-2">
                  <WeightControl
                    label={`${field.label} priority`}
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
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-1.5 text-[0.6875rem] text-muted-foreground">
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
    </div>
  );
}
