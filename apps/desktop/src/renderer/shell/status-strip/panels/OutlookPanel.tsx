import { cn } from "../../../lib/utils.js";
import { BalanceCard } from "../cards/BalanceCard.js";
import { TreasuryCard } from "../cards/TreasuryCard.js";
import { rowById } from "../rows.js";
import { StripBadge } from "../StripBadge.js";
import { StripCard } from "../StripCard.js";
import { StripGlyph, TONE_FILL } from "../StripGlyph.js";
import { StripPanel } from "../StripPanel.js";
import { FIELD_LABEL } from "../strip-styles.js";
import { useStatusStripState } from "../StatusStripContext.js";
import { StatusStripControls } from "../StatusStripControls.js";
import { StripTrend } from "../StripTrend.js";

const RUNWAY_PIPS = 12;

export function OutlookPanel() {
  const { model, trend } = useStatusStripState();
  const balance = rowById(model.budget, "balance");
  const treasury = rowById(model.budget, "treasury");
  const runway = rowById(model.budget, "runway");
  const shortfall = rowById(model.budget, "shortfall");
  const alert = balance?.tone === "alert";
  const runwayMonths = model.outlook.runwayMonths;
  return (
    <StripPanel name="Outlook" actions={<StatusStripControls />}>
      <div className="space-y-1.5">
        {balance !== undefined && (
          <StripCard
            row={balance}
            detail={<BalanceCard outlook={model.outlook} trend={trend} />}
            width="w-96"
            className={cn(
              "gap-0 py-1.5",
              alert ? "border-destructive/40 bg-destructive/10" : "border-success/30 bg-success/10",
            )}
          >
            <span className={cn(FIELD_LABEL, "text-foreground/80")}>{balance.label}</span>
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-xl leading-7 font-semibold tabular-nums">
                {balance.value}
              </span>
              <span className="flex flex-col items-end gap-1">
                {balance.status !== undefined && (
                  <StripBadge status={balance.status} tone={balance.tone} />
                )}
                {trend !== null && trend.net.values.length > 1 && (
                  <StripGlyph variant="line" values={trend.net.values} tone={balance.tone} />
                )}
              </span>
            </span>
          </StripCard>
        )}
        <div className="grid grid-cols-2 gap-1">
          {treasury !== undefined && (
            <StripCard
              row={treasury}
              detail={<TreasuryCard outlook={model.outlook} trend={trend} />}
              width="w-80"
              className="gap-0.5 py-1.5"
            >
              <span className={FIELD_LABEL}>{treasury.label}</span>
              <span className="flex items-baseline gap-1.5">
                {trend !== null && (
                  <StripTrend variant="delta" series={trend.treasury} className="text-xs" />
                )}
                <span className="font-display text-sm font-semibold tabular-nums">
                  {treasury.value}
                </span>
              </span>
            </StripCard>
          )}
          {runway !== undefined && (
            <StripCard row={runway} className="gap-1 py-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className={FIELD_LABEL}>{runway.label}</span>
                <span className="text-xs font-medium tabular-nums">{runway.value}</span>
              </span>
              <StripGlyph
                variant="pips"
                filled={Math.min(runwayMonths ?? 0, RUNWAY_PIPS)}
                total={RUNWAY_PIPS}
                fill={(runwayMonths ?? 0) <= 3 ? TONE_FILL.alert : "bg-admiralty-signal"}
              />
            </StripCard>
          )}
          {shortfall !== undefined && (
            <StripCard
              row={shortfall}
              className="col-span-2 flex-row items-center justify-between gap-3 border-destructive/40 bg-destructive/10 py-1"
            >
              <span className={FIELD_LABEL}>{shortfall.label}</span>
              <span className="text-xs font-semibold tabular-nums text-destructive">
                {shortfall.value}
              </span>
            </StripCard>
          )}
        </div>
      </div>
    </StripPanel>
  );
}
