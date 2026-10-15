import type { BattleOutcome } from "@bluewave/campaign-engine";

import { Badge } from "../../../components/ui/badge.js";
import { cn } from "../../../lib/utils.js";

/**
 * One resolved battle, straight from the projection — raw engine ids, never
 * invented display names. A battle with `winnerId`/`loserId` both null is
 * genuinely undecided (tie / time limit) and is shown as such: no fabricated
 * winner, no fabricated war score.
 */
export function BattleOutcomeRow({ battle }: { readonly battle: BattleOutcome }) {
  const decided = battle.winnerId !== null && battle.loserId !== null;

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/10 p-2.5 font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-muted/40 pb-1">
        <span className="font-semibold text-foreground">BATTLE: {battle.battleId}</span>
        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          {battle.areaId}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-foreground">{battle.attackerId}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="font-semibold text-foreground">{battle.defenderId}</span>
      </div>

      {decided ? (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-success">Winner: {battle.winnerId}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-destructive">Loser: {battle.loserId}</span>
        </div>
      ) : (
        <div className="text-muted-foreground">No conclusive result (tie / time limit)</div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-muted-foreground">War score delta</span>
        <span className={cn("font-semibold", decided ? "text-success" : "text-muted-foreground")}>
          {decided
            ? battle.warScoreDelta === 0
              ? "n/a (not re-derived)"
              : `+${battle.warScoreDelta}`
            : "0 (non-decided)"}
        </span>
      </div>

      <ShipLossSummary label="Attacker losses" losses={battle.attackerLosses} />
      <ShipLossSummary label="Defender losses" losses={battle.defenderLosses} />

      {battle.explanation.length > 0 && (
        <div className="space-y-0.5 border-t border-muted/40 pt-1">
          {battle.explanation.map((line, idx) => (
            <div key={idx} className="text-[10px] text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ship-loss row: count + the raw ship ids, or an honest empty marker. */
function ShipLossSummary({
  label,
  losses,
}: {
  readonly label: string;
  readonly losses: readonly string[];
}) {
  return (
    <div className="border-t border-muted/40 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
        {losses.length === 0 ? (
          <span className="text-muted-foreground">no losses</span>
        ) : (
          <span className="font-semibold text-destructive">{losses.length} lost</span>
        )}
      </div>
      {losses.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {losses.map((shipId) => (
            <code
              key={shipId}
              className="rounded-sm bg-muted/40 px-1 py-0.5 text-[10px] text-foreground"
            >
              {shipId}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}
