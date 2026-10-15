import type { ReactNode } from "react";

import { Badge } from "../../../components/ui/badge.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={muted === true ? "text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className="text-sm font-medium tabular-nums">{value.toLocaleString()}</span>
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

/** The income / expenditure / result cards, folded from a treasury breakdown. */
export function TreasurySummaryCards({ breakdown }: { readonly breakdown: TreasuryBreakdown }) {
  const deficit = breakdown.projectedSurplusDeficit < 0;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SummaryCard title="Income">
        <Row label="Government naval allocation" value={breakdown.income} />
      </SummaryCard>

      <SummaryCard title="Expenditure">
        <Row label="Fleet maintenance" value={breakdown.fleetMaintenance} />
        <Row label="Construction" value={breakdown.constructionSpend} />
        <Row label="Research" value={breakdown.researchSpend} />
        <div className="h-px bg-border" />
        <Row label="Total expenditure" value={breakdown.totalExpenditure} />
      </SummaryCard>

      <SummaryCard title="Result">
        <Row label="Projected surplus / deficit" value={breakdown.projectedSurplusDeficit} />
        <Row label="Available funds" value={breakdown.availableFunds} />
        <Row label="Projected month-end funds" value={breakdown.projectedMonthEndFunds} />
        <Badge
          variant="outline"
          className={deficit ? "mt-1 border-destructive/50 text-destructive" : "mt-1"}
        >
          {deficit ? "Deficit" : "Surplus"}
        </Badge>
      </SummaryCard>
    </div>
  );
}
