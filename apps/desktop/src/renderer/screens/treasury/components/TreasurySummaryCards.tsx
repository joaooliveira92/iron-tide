import type { ReactNode } from "react";

import { Badge } from "../../../components/ui/badge.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import { economyStatusLabel, researchNote } from "../../../lib/economy-wording.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { formatCount } from "../../../lib/presentation-format/index.js";

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={muted === true ? "text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className="text-sm font-medium tabular-nums">{formatCount(value)}</span>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </GlassCard>
  );
}

export function TreasurySummaryCards({ breakdown }: { readonly breakdown: TreasuryBreakdown }) {
  const deficit = breakdown.projectedSurplusDeficit < 0;
  const note = researchNote(breakdown);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SummaryCard title="Income">
        <Row label="Monthly naval appropriation" value={breakdown.income} />
      </SummaryCard>

      <SummaryCard title="Expenditure">
        <Row label="Fixed obligations" value={breakdown.obligations} />
        <Row label="Fleet maintenance" value={breakdown.fleetMaintenance} />
        <Row label="Research" value={breakdown.researchSpend} />
        <div className="h-px bg-border" />
        <Row label="Committed expenditure" value={breakdown.totalExpenditure} />
        <Row label="Construction (up to)" value={breakdown.plannedConstruction} muted />
        {note !== null && <p className="text-xs text-muted-foreground">{note}</p>}
      </SummaryCard>

      <SummaryCard title="Result">
        <Row label="Projected net before construction" value={breakdown.projectedSurplusDeficit} />
        <Row label="Available funds" value={breakdown.availableFunds} />
        <Row label="Projected month-end funds" value={breakdown.projectedMonthEndFunds} />
        {breakdown.shortfall > 0 && (
          <p className="text-sm text-destructive">
            Shortfall: {formatCount(breakdown.shortfall)} of this month&apos;s costs cannot be paid.
          </p>
        )}
        {breakdown.runwayMonths !== undefined && (
          <p className="text-sm text-muted-foreground">
            Treasury lasts {formatCount(breakdown.runwayMonths)}{" "}
            {breakdown.runwayMonths === 1 ? "month" : "months"} at this rate.
          </p>
        )}
        <Badge
          variant="outline"
          className={deficit ? "mt-1 border-destructive/50 text-destructive" : "mt-1"}
        >
          {economyStatusLabel(breakdown.status)}
        </Badge>
      </SummaryCard>
    </div>
  );
}
