import { Undo2 } from "lucide-react";

import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import type { BudgetKnobId } from "../budget-policy-view-model.js";
import type { BudgetPolicy } from "../hooks/useBudgetPolicyPanel.js";
import { DialSlider } from "./DialSlider.js";

export function BudgetPolicyPanel({ policy }: { readonly policy: BudgetPolicy }) {
  const { controller, vm } = policy;

  function handleChange(id: BudgetKnobId, value: number): void {
    if (id === "appropriation") controller.setRate(value);
    else controller.setResearch(value);
  }

  return (
    <aside
      aria-label="Budget allocation"
      data-testid="budget-policy-panel"
      className="flex min-h-0 flex-col border-t lg:border-l lg:border-t-0"
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-medium">Budget allocation</h3>
        {vm.dirty && <Badge variant="outline">Unapplied</Badge>}
      </header>
      <div className="themed-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {vm.loadError !== null && (
          <p role="alert" className="whitespace-pre-line text-sm text-destructive">
            {vm.loadError}
          </p>
        )}
        {vm.loaded &&
          vm.knobs.map((knob) => (
            <DialSlider
              key={knob.id}
              knob={knob}
              onChange={(value) => handleChange(knob.id, value)}
            />
          ))}
        {vm.notice !== null && (
          <p role="status" className="whitespace-pre-line text-sm text-muted-foreground">
            {vm.notice}
          </p>
        )}
      </div>
      {vm.loaded && (
        <footer className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2">
          <Button type="button" size="sm" disabled={!vm.canApply} onClick={controller.apply}>
            Apply allocation
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!vm.dirty || vm.busy}
            onClick={controller.reset}
          >
            <Undo2 aria-hidden="true" />
            Reset
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">Applies next month</span>
        </footer>
      )}
    </aside>
  );
}
