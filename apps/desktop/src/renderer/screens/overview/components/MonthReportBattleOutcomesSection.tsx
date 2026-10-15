import type { BattleOutcome } from "@bluewave/campaign-engine";
import { campaignNationLabel } from "../../../content/presentationContent.js";
import { describeBattle } from "../month-report-format.js";

/**
 * The report's dedicated Battle Outcomes subsection (spec §16): the real
 * `closingSnapshot.battleOutcomes` as plain text losses/outcomes. Kept distinct
 * from Fleet; no tactical UI.
 */
export function MonthReportBattleOutcomesSection({
  battles,
  areaName,
}: {
  readonly battles: readonly BattleOutcome[];
  readonly areaName: (id: string) => string;
}) {
  if (battles.length === 0) {
    return (
      <section aria-label="Battle Outcomes">
        <p className="font-medium">Battle Outcomes</p>
        <p className="text-muted-foreground">No engagements this month.</p>
      </section>
    );
  }

  return (
    <section aria-label="Battle Outcomes" className="space-y-1">
      <p className="font-medium">Battle Outcomes</p>
      <ul className="space-y-1" aria-label="Battles this month">
        {battles.map((battle) => (
          <li key={battle.battleId}>{describeBattle(battle, campaignNationLabel, areaName)}</li>
        ))}
      </ul>
    </section>
  );
}
