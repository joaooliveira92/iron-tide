import { TriangleAlert } from "lucide-react";
import { humanizeId } from "../../../lib/humanize-id.js";
import { cn } from "../../../lib/utils.js";
import { TENSION_TONES } from "../diplomacy-presentation.js";
import type { DiplomacyViewModel } from "../diplomacy-view-model.js";
import { NationFlag } from "./NationFlag.js";
import { TensionGauge } from "./TensionGauge.js";

const WATCHLIST = 5;

export interface OverviewSummaryProps {
  readonly vm: DiplomacyViewModel;
  readonly onSelect: (partnerNationId: string) => void;
}

export function OverviewSummary({ vm, onSelect }: OverviewSummaryProps) {
  const { posture } = vm;
  const atWar = posture.activeWars > 0;
  const tense = posture.mostTense;
  const watchlist = vm.relations.slice(0, WATCHLIST);
  return (
    <div className="space-y-3" data-testid="overview-summary">
      <section className="space-y-1 rounded-md border p-3">
        <h2 className={cn("text-lg font-semibold tracking-tight", atWar && "text-destructive")}>
          {atWar ? "At war" : "At peace"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {atWar
            ? `${posture.activeWars === 1 ? "1 active war" : `${posture.activeWars} active wars`}. Peace can be accepted from the war panel.`
            : tense !== null && tense.tension >= 6
              ? `Watch ${tense.partnerName}: relations are ${humanizeId(tense.band).toLowerCase()}.`
              : "No nation is close to war."}
        </p>
      </section>

      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">Closest to war</h3>
        {watchlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">No relations recorded yet</p>
        ) : (
          <ul className="space-y-1">
            {watchlist.map((row) => (
              <li key={row.partnerNationId}>
                <button
                  type="button"
                  onClick={() => onSelect(row.partnerNationId)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <NationFlag
                    url={row.flagUrl}
                    name={row.partnerName}
                    className="h-6 w-9 rounded-[3px] border border-border shadow-sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.partnerName}</span>
                    <span className={cn("block text-xs", TENSION_TONES[row.band].text)}>
                      {row.atWar ? "At war" : humanizeId(row.band)}
                    </span>
                  </span>
                  <TensionGauge tension={row.tension} band={row.band} />
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                    {row.tension}/10
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">Blockades</h3>
        {vm.blockades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blockades yet</p>
        ) : (
          <ul className="space-y-1.5">
            {vm.blockades.map((blockade) => (
              <li key={blockade.key} className="text-sm">
                <span className="font-medium">
                  {blockade.blockaderName} → {blockade.blockadedName}
                </span>{" "}
                <span className="text-muted-foreground">
                  in {blockade.areaLabel}, since {blockade.establishedMonth}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-1.5 px-0.5 text-xs text-muted-foreground">
        <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        Commands are validated by the engine when submitted. A rejected command shows the engine's
        code, never a fabricated message.
      </p>
    </div>
  );
}
