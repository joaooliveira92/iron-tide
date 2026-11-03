import { memo } from "react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { KG_PER_TONNE } from "../../../lib/presentation-format/units.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { WizardSection } from "./WizardSection.js";
import { constructionWizardView } from "./wizard-view.js";

const COST_BASIS_TEXT: Record<CompiledDesignVersion["costBasis"], string> = {
  design_cost_model: "priced by the ship-design cost model",
  displacement_formula: "construction_order_v1 · 1 per 100t",
};

export interface ConstructionWizardProps {
  readonly design: CompiledDesignVersion | null;
  readonly economy: { readonly treasury: number; readonly shipyardCapacity: number } | null;
  readonly workspace: {
    readonly treasuryReserved: number;
    readonly capacityReserved: number;
  } | null;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly onConfirm: () => void;
  readonly onCancelWizard?: () => void;
}

export const ConstructionWizard = memo(function ConstructionWizard({
  design,
  economy,
  workspace,
  busy,
  notice,
  onConfirm,
  onCancelWizard,
}: ConstructionWizardProps) {
  const format = usePresentationFormat();

  if (design === null) {
    return (
      <Card data-testid="construction-wizard-empty">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Order Review</CardTitle>
          <CardDescription>Select a design to review its order details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const view = constructionWizardView(design, economy, workspace);

  return (
    <Card data-testid="construction-wizard">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Review — {design.className}</CardTitle>
        <CardDescription>
          Select-design → review → confirm. No ship name, no completion-time estimate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <WizardSection title="Design summary" testId="wizard-design-summary" className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="font-mono text-xs">
              {design.className}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {design.shipType}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {design.year}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {format.measurement(design.mass * KG_PER_TONNE, "mass", { maximumFractionDigits: 0 })}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {design.speed}kt
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {design.machineryType}
            </Badge>
          </div>
          {design.requiredTechnologyIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {design.requiredTechnologyIds.join(", ")}
            </p>
          )}
        </WizardSection>

        <WizardSection
          title="Dock requirement"
          testId="wizard-dock-requirement"
          className="space-y-1"
        >
          <p className="font-mono text-sm">
            {format.count(view.projectedCapacityUnits)} capacity units required
            <span className="text-muted-foreground">
              {" "}
              · shipyard capacity {format.count(view.capacity)}
            </span>
          </p>
          {view.capacityOver && (
            <p className="text-xs text-destructive">
              INSUFFICIENT_CAPACITY — required exceeds available capacity.
            </p>
          )}
        </WizardSection>

        <WizardSection
          title="Total projected cost"
          testId="wizard-projected-cost"
          className="space-y-1"
        >
          <p className="font-mono text-sm">
            {format.money(view.projectedCost)} treasury units
            <span className="text-muted-foreground"> · {COST_BASIS_TEXT[design.costBasis]}</span>
          </p>
        </WizardSection>

        <WizardSection
          title="Reservation impact"
          testId="wizard-reservation-impact"
          className="space-y-1"
        >
          <p className="font-mono text-xs">
            Treasury reserved {format.money(view.reservedTreasury)} →{" "}
            {format.money(view.afterTreasury)} / {format.money(view.treasury)}
            {view.treasuryOver ? " · exceeds treasury" : ""}
          </p>
          <p className="font-mono text-xs">
            Capacity reserved {format.count(view.reservedCapacity)} →{" "}
            {format.count(view.afterCapacity)} / {format.count(view.capacity)}
            {view.capacityOver ? " · exceeds capacity" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Order reserves the full projected cost immediately; low cash is INSUFFICIENT_FUNDS,
            never placed with warning.
          </p>
          {view.treasuryOver && (
            <p className="text-xs text-destructive">
              INSUFFICIENT_FUNDS — treasury cannot cover projected cost.
            </p>
          )}
        </WizardSection>

        {notice !== null && (
          <Alert variant="destructive">
            <AlertTitle>Not applied</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{notice}</AlertDescription>
          </Alert>
        )}

        <ButtonGroup>
          <Button data-testid="wizard-confirm" onClick={onConfirm} disabled={busy} size="sm">
            Confirm order
          </Button>
          {onCancelWizard && (
            <Button variant="outline" size="sm" onClick={onCancelWizard} disabled={busy}>
              Back to catalog
            </Button>
          )}
        </ButtonGroup>
      </CardContent>
    </Card>
  );
});
