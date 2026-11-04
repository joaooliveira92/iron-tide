import { GlassCard } from "../../../components/ui/glass-card.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { formatTreasury } from "../../../shell/site-header-state.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { BriefingDetailRow } from "./BriefingDetailRow.js";
import type { OpeningBriefingPageViewProps } from "./opening-briefing-page-views.js";

function formatSignedMoney(value: number, format: PresentationFormat): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${formatTreasury(Math.abs(value), format)}`;
}

export function TreasuryPage({ projection }: OpeningBriefingPageViewProps) {
  const format = usePresentationFormat();
  const { treasury } = projection;
  return (
    <div className="flex flex-col gap-4">
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col p-4">
          <BriefingDetailRow
            label="Government allocation"
            value={formatTreasury(treasury.governmentAllocation, format)}
          />
          <BriefingDetailRow
            label="Fixed obligations"
            value={`−${formatTreasury(treasury.obligations, format)}`}
          />
          <BriefingDetailRow
            label="Fleet maintenance"
            value={`−${formatTreasury(treasury.fleetMaintenance, format)}`}
          />
          <BriefingDetailRow
            label="Research expenditure"
            value={`−${formatTreasury(treasury.researchExpenditure, format)}`}
          />
          <BriefingDetailRow
            label="Projected surplus / deficit"
            value={formatSignedMoney(treasury.projectedSurplus, format)}
          />
          {treasury.runwayMonths !== undefined && (
            <BriefingDetailRow
              label="Treasury lasts"
              value={`${String(treasury.runwayMonths)} ${treasury.runwayMonths === 1 ? "month" : "months"}`}
            />
          )}
        </div>
      </GlassCard>
      <GlassCard glassVariant="liquid-refract">
        <div className="p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Treasury outlook
          </p>
          <p className="mt-1 text-sm font-medium capitalize">{treasury.status}</p>
        </div>
      </GlassCard>
    </div>
  );
}
