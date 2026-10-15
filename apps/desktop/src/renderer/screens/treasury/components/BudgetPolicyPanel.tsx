import { Button } from "../../../components/ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import { buildBudgetPolicyViewModel, type BudgetKnobId } from "../budget-policy-view-model.js";
import { useBudgetPolicyPanel } from "../hooks/useBudgetPolicyPanel.js";
import { BudgetSlider } from "./BudgetSlider.js";

export interface BudgetPolicyPanelProps {
  readonly sessionId: string;
}

/**
 * Player budget allocation (F-12, ADR-0060): the naval appropriation rate and a
 * standing monthly research budget. Bounds come from the engine; the engine
 * re-validates on submit and applies the change when the month is advanced.
 * The command lifecycle lives in `useBudgetPolicyPanel`; this only renders.
 */
export function BudgetPolicyPanel({ sessionId }: BudgetPolicyPanelProps) {
  const controller = useBudgetPolicyPanel(sessionId);
  const vm = buildBudgetPolicyViewModel({
    state: controller.state,
    rate: controller.rate,
    research: controller.research,
    loadError: controller.loadError,
  });

  function handleChange(id: BudgetKnobId, value: number): void {
    if (id === "appropriation") controller.setRate(value);
    else controller.setResearch(value);
  }

  return (
    <GlassCard glassVariant="liquid-refract" data-testid="budget-policy-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Budget allocation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vm.loadError !== null && (
          <p role="alert" className="whitespace-pre-line text-sm text-destructive">
            {vm.loadError}
          </p>
        )}
        {vm.loaded && (
          <>
            {vm.knobs.map((knob) => (
              <BudgetSlider
                key={knob.id}
                knob={knob}
                onChange={(value) => handleChange(knob.id, value)}
              />
            ))}
            <Button type="button" size="sm" disabled={!vm.canApply} onClick={controller.apply}>
              Apply allocation
            </Button>
          </>
        )}
        {vm.notice !== null && (
          <p role="status" className="whitespace-pre-line text-sm text-muted-foreground">
            {vm.notice}
          </p>
        )}
      </CardContent>
    </GlassCard>
  );
}
