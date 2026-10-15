import { useState } from "react";
import { Checkbox } from "../../ui/checkbox.js";
import { cn } from "../../../lib/utils.js";
import { SelectField } from "../fields.js";
import { sameEntity } from "../selection/store.js";
import { useSelectionStore, useShipSelection } from "../selection/useShipSelection.js";
import type { BoardFinding } from "./boardFindings.js";
import { FILTER_LABEL, SEVERITY_FILTERS, SEVERITY_STYLE, type SeverityFilter } from "./severity.js";

export const FINDINGS_VIEW_KEY = "bluewave-drawing-board-findings";

export interface FindingsView {
  readonly visible: boolean;
  readonly filter: SeverityFilter;
}

const DEFAULT_VIEW: FindingsView = { visible: true, filter: "all" };

/** The stored choice, or the default for anything missing or unrecognised. */
export function readFindingsView(): FindingsView {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(FINDINGS_VIEW_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return DEFAULT_VIEW;
    const r = raw as Record<string, unknown>;
    const filter = SEVERITY_FILTERS.find((f) => f === r["filter"]) ?? DEFAULT_VIEW.filter;
    return { visible: r["visible"] !== false, filter };
  } catch {
    return DEFAULT_VIEW;
  }
}

/** Whether findings show on the plan, and which: a local view preference like the split width, never design state. */
export function useFindingsView(): readonly [FindingsView, (next: FindingsView) => void] {
  const [view, setView] = useState(readFindingsView);
  const set = (next: FindingsView) => {
    try {
      localStorage.setItem(FINDINGS_VIEW_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
    setView(next);
  };
  return [view, set];
}

/** Whether findings show on the plan, and which severities: the display half of the findings control. */
export function FindingsViewOptions({
  view,
  onChange,
  className,
}: {
  readonly view: FindingsView;
  readonly onChange: (next: FindingsView) => void;
  readonly className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3 text-sm", className)}>
      <div className="flex items-center gap-2 pb-1.5">
        <Checkbox
          aria-label="Show findings on the plan"
          checked={view.visible}
          onCheckedChange={(v) => onChange({ ...view, visible: v === true })}
        />
        <span aria-hidden="true">Show findings</span>
      </div>
      <SelectField
        className="min-w-44"
        label="Findings to show"
        value={view.filter}
        options={SEVERITY_FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f] }))}
        onChange={(v) => {
          const filter = SEVERITY_FILTERS.find((f) => f === v);
          if (filter) onChange({ ...view, filter });
        }}
      />
    </div>
  );
}

/**
 * The ship-level findings: they have no place on the drawing, so they sit beside it as one button that pins the whole
 * ship. Nothing renders when there are none or findings are hidden.
 */
export function ShipFindingsButton({
  view,
  shipFindings,
  className,
}: {
  readonly view: FindingsView;
  readonly shipFindings: readonly BoardFinding[];
  readonly className?: string;
}) {
  const store = useSelectionStore();
  const shipSelected = useShipSelection((s) => sameEntity(s.selected, { kind: "ship" }));
  const top = shipFindings[0];
  const style = top ? SEVERITY_STYLE[top.severity] : undefined;
  if (!top || !style || !view.visible) return null;
  return (
    <button
      type="button"
      data-ship-findings="true"
      aria-pressed={shipSelected}
      aria-label={`Whole ship: ${shipFindings.length} finding${shipFindings.length === 1 ? "" : "s"}, most severe ${style.label.toLowerCase()}: ${top.title}`}
      onClick={() => store.select({ kind: "ship" }, top.key)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        "aria-pressed:border-primary aria-pressed:font-semibold",
        className,
      )}
    >
      <style.Icon aria-hidden="true" className={cn("size-4", style.tone)} />
      Whole ship · {shipFindings.length}
    </button>
  );
}

/** The plan's validation control when the plan is shown on its own: the display options and the ship-level button. */
export function FindingsControl({
  view,
  onChange,
  shipFindings,
}: {
  readonly view: FindingsView;
  readonly onChange: (next: FindingsView) => void;
  readonly shipFindings: readonly BoardFinding[];
}) {
  return (
    <div
      className="flex flex-wrap items-end gap-3 text-sm"
      role="group"
      aria-label="Findings on the plan"
    >
      <FindingsViewOptions view={view} onChange={onChange} />
      <ShipFindingsButton view={view} shipFindings={shipFindings} className="mb-0.5" />
    </div>
  );
}
