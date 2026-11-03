import { GlassCard } from "../../../components/ui/glass-card.js";
import { formatTreasury } from "../../../shell/site-header-state.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { BriefingDetailRow } from "./BriefingDetailRow.js";
import type { OpeningBriefingPageViewProps } from "./opening-briefing-page-views.js";

export function StateOfTheNavyPage({ projection }: OpeningBriefingPageViewProps) {
  const format = usePresentationFormat();
  const { stateOfTheNavy } = projection;
  return (
    <div className="flex flex-col gap-4">
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col gap-1 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ship-class inventory
          </p>
          {stateOfTheNavy.shipClassCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissioned ships on the roster.</p>
          ) : (
            stateOfTheNavy.shipClassCounts.map(({ label, count }) => (
              <BriefingDetailRow key={label} label={label} value={count} />
            ))
          )}
        </div>
      </GlassCard>
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col p-4">
          <BriefingDetailRow
            label="Ships under construction"
            value={stateOfTheNavy.shipsUnderConstruction}
          />
          <BriefingDetailRow
            label="Most expensive active class"
            value={
              stateOfTheNavy.mostExpensiveActiveClass === null
                ? "—"
                : `${stateOfTheNavy.mostExpensiveActiveClass.className} (${formatTreasury(stateOfTheNavy.mostExpensiveActiveClass.projectedCost, format)})`
            }
          />
          <BriefingDetailRow
            label="Largest available dock"
            value={stateOfTheNavy.largestDockCapacity}
          />
          <BriefingDetailRow
            label="Total maintenance expense"
            value={formatTreasury(stateOfTheNavy.totalMaintenance, format)}
          />
          <BriefingDetailRow
            label="Construction committed"
            value={formatTreasury(stateOfTheNavy.constructionCommitted, format)}
          />
        </div>
      </GlassCard>
    </div>
  );
}
