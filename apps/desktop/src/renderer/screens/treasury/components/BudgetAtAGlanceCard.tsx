import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { BudgetBar } from "./BudgetBar.js";

export function BudgetAtAGlanceCard({ breakdown }: { readonly breakdown: TreasuryBreakdown }) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Budget at a glance</CardTitle>
      </CardHeader>
      <CardContent>
        <BudgetBar breakdown={breakdown} />
      </CardContent>
    </GlassCard>
  );
}
