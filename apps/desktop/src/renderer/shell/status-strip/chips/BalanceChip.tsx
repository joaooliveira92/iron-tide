import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import type { StatusStripModel } from "../../status-strip-state.js";
import type { TrendDetail } from "../../status-strip-trend.js";
import { BalanceCard } from "../cards/BalanceCard.js";
import { PinnableCard } from "../StripCard.js";
import { StripBadge } from "../StripBadge.js";
import { StripGlyph } from "../StripGlyph.js";
import { CHIP } from "../strip-styles.js";

export function BalanceChip({
  model,
  trend,
}: {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
}) {
  const { summary } = model;
  const alert = summary.balance.tone === "alert";
  return (
    <PinnableCard
      trigger={<button type="button" />}
      variant="button"
      align="start"
      triggerProps={{
        "aria-label": `Monthly balance ${summary.balance.value}, ${summary.balance.status}`,
      }}
      triggerClassName={cn(CHIP, "cursor-help", alert && "border-destructive/40 bg-destructive/10")}
      card={<BalanceCard outlook={model.outlook} trend={trend} />}
      width="w-96"
    >
      {alert ? (
        <TrendingDown className="size-3.5 text-destructive" aria-hidden="true" />
      ) : (
        <TrendingUp className="size-3.5 text-success" aria-hidden="true" />
      )}
      <span className="text-muted-foreground">Balance</span>
      <span className={cn("font-display tabular-nums font-semibold", alert && "text-destructive")}>
        {summary.balance.value}
      </span>
      {trend !== null && trend.net.values.length > 1 && (
        <StripGlyph
          variant="line"
          values={trend.net.values}
          tone={summary.balance.tone}
          className="h-4 w-12"
        />
      )}
      <StripBadge status={summary.balance.status} tone={summary.balance.tone} />
    </PinnableCard>
  );
}
