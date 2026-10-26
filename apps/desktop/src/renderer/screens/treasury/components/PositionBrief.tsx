import { AlertTriangle, CheckCircle2, Hourglass } from "lucide-react";

import { Badge } from "../../../components/ui/badge.js";
import { economyStatusLabel } from "../../../lib/economy-wording.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { UnpaidCostsPrestige } from "../../../../shared/budget-contract.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";

export function PositionBrief({
  breakdown,
  pendingRateChange,
  unpaidCostsPrestige,
}: {
  readonly breakdown: TreasuryBreakdown;
  readonly pendingRateChange: boolean;
  readonly unpaidCostsPrestige: UnpaidCostsPrestige | null;
}) {
  const format = usePresentationFormat();
  const net = breakdown.projectedSurplusDeficit;
  const deficit = net < 0;
  const Icon = deficit ? AlertTriangle : CheckCircle2;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Icon
          aria-hidden="true"
          className={cn("size-5 shrink-0", deficit ? "text-destructive" : "text-success")}
        />
        <p className="text-base font-medium tracking-tight">
          {deficit
            ? `Spending exceeds income by ${format.count(-net)} this month.`
            : `Spending is within income, with ${format.count(net)} to spare before construction.`}
        </p>
        <Badge
          variant="outline"
          className={deficit ? "border-destructive/50 text-destructive" : undefined}
        >
          {economyStatusLabel(breakdown.status)}
        </Badge>
      </div>
      {breakdown.shortfall > 0 && (
        <p className="text-sm text-destructive">
          Shortfall: {format.count(breakdown.shortfall)} of this month&apos;s costs cannot be paid.
        </p>
      )}
      {unpaidCostsPrestige?.triggered === true && (
        <p role="alert" className="text-sm text-destructive">
          Unpaid obligations also cost prestige: {format.count(unpaidCostsPrestige.before)} →{" "}
          {format.count(unpaidCostsPrestige.after)}.{" "}
          {unpaidCostsPrestige.after <= unpaidCostsPrestige.sackingThreshold
            ? `That is at or below ${format.count(unpaidCostsPrestige.sackingThreshold)}, where you risk dismissal.`
            : `Dismissal risk begins at ${format.count(unpaidCostsPrestige.sackingThreshold)}.`}
        </p>
      )}
      {breakdown.runwayMonths !== undefined && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Hourglass aria-hidden="true" className="size-3.5" />
          Treasury lasts {format.count(breakdown.runwayMonths)}{" "}
          {breakdown.runwayMonths === 1 ? "month" : "months"} at this rate.
        </p>
      )}
      {pendingRateChange && (
        <p className="text-xs text-muted-foreground">
          A new appropriation rate changes income too. The figures here show the current rate until
          you apply it and advance the month.
        </p>
      )}
    </div>
  );
}
