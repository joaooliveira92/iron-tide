import { Landmark } from "lucide-react";

import type { StatusStripModel } from "../../status-strip-state.js";
import type { TrendDetail } from "../../status-strip-trend.js";
import { TreasuryCard } from "../cards/TreasuryCard.js";
import { PinnableCard } from "../StripCard.js";
import { CHIP } from "../strip-styles.js";
import { StripTrend } from "../StripTrend.js";

export function TreasuryChip({
  model,
  trend,
}: {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
}) {
  return (
    <PinnableCard
      trigger={<button type="button" />}
      variant="button"
      triggerProps={{
        "aria-label":
          trend?.treasury.delta == null
            ? `Treasury ${model.summary.treasury}`
            : `Treasury ${model.summary.treasury}, ${trend.treasury.delta} on ${trend.treasury.labels.at(-2) ?? "the previous month"}`,
      }}
      triggerClassName={CHIP}
      card={<TreasuryCard outlook={model.outlook} trend={trend} />}
      width="w-80"
    >
      <Landmark className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">Treasury</span>
      <span className="font-display tabular-nums font-semibold">{model.summary.treasury}</span>
      {trend !== null && <StripTrend variant="delta" series={trend.treasury} />}
    </PinnableCard>
  );
}
