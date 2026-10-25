import { Badge } from "../../../components/ui/badge.js";
import { humanizeId } from "../../../lib/humanize-id.js";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import type { BattleHistoryState } from "../hooks/useBattleHistory.js";
import {
  ABSENCE_REASON_LABELS,
  OUTCOME_LABELS,
  shipsLabel,
  summarizeBattleHistory,
} from "../battle-history-state.js";

const OUTCOME_VARIANT = {
  won: "default",
  lost: "destructive",
  undecided: "secondary",
  "not-involved": "outline",
} as const;

const CAUSE_LABELS: Readonly<Record<string, string>> = {
  gunfire: "sunk by gunfire",
  fire: "lost to fire",
  flooding: "lost to flooding",
  torpedo: "sunk by torpedo",
};

export function BattleHistorySection({ state }: { readonly state: BattleHistoryState }) {
  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading battle history…</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        Battle history unavailable: {state.message}
      </p>
    );
  }
  const battles = state.history.battles;
  if (battles.length === 0) {
    return <p className="text-sm text-muted-foreground">No battles fought yet</p>;
  }
  const summary = summarizeBattleHistory(battles);
  return (
    <div className="space-y-2.5">
      {summary.played > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="battle-summary">
          {summary.played} {summary.played === 1 ? "battle" : "battles"} fought · {summary.won} won
          · {summary.lost} lost · {summary.undecided} undecided · you lost{" "}
          {shipsLabel(summary.playerLosses)}, the enemy lost {shipsLabel(summary.enemyLosses)}
        </p>
      )}
      {battles.map((battle) => (
        <div
          key={battle.battleId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={OUTCOME_VARIANT[battle.outcomeForPlayer]}>
              {OUTCOME_LABELS[battle.outcomeForPlayer]}
            </Badge>
            <span className="text-sm">
              {battle.attackerName} vs {battle.defenderName}
            </span>
            <span className="text-xs text-muted-foreground">in {battle.areaName}</span>
            {DEBUG_MODE && (
              <span className="font-mono text-xs text-muted-foreground">{battle.battleId}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {battle.involvesPlayer
              ? `you lost ${shipsLabel(battle.playerLossCount)} · enemy lost ${shipsLabel(battle.enemyLossCount)}`
              : `${shipsLabel(battle.enemyLossCount)} lost`}
          </span>
          {battle.lostShips.length > 0 && (
            <ul className="w-full space-y-0.5 text-xs" aria-label="Ships lost in this battle">
              {battle.lostShips.map((ship) => (
                <li key={`${ship.name}-${ship.month}`} className="flex flex-wrap gap-x-2">
                  <span className={ship.ownedByPlayer ? "font-medium" : undefined}>
                    {ship.name}
                  </span>
                  <span className="text-muted-foreground">
                    {humanizeId(ship.classId)} · {ship.nationName}
                    {ship.cause !== null && ` · ${CAUSE_LABELS[ship.cause] ?? ship.cause}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(battle.absentShips ?? []).length > 0 && (
            <ul className="w-full space-y-0.5 text-xs" aria-label="Ships absent from this battle">
              {(battle.absentShips ?? []).map((ship) => (
                <li key={ship.shipId} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{ship.shipName}</span>
                  <span className="text-muted-foreground">
                    absent: {ship.reasons.map((reason) => ABSENCE_REASON_LABELS[reason]).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {battles.some((b) => b.lostShipIds.length > 0 && b.lostShips.length === 0) && (
        <p className="text-xs text-muted-foreground">
          Battles from before ship records were kept show only how many ships were lost.
        </p>
      )}
    </div>
  );
}
