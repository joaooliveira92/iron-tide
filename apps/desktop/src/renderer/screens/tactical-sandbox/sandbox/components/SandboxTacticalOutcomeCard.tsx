import type { TacticalBattleOutcome } from "@bluewave/campaign-engine";
import { Radar, Waves } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card.js";
import { SandboxStat } from "./SandboxStat.js";

export function SandboxTacticalOutcomeCard({
  outcome,
}: {
  readonly outcome: TacticalBattleOutcome;
}) {
  return (
    <>
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <Radar className="h-4 w-4" />
            Tactical Outcome — {outcome.turnsResolved} turns resolved
          </CardTitle>
          <CardDescription>
            End condition: {outcome.endCondition} · War score: {outcome.warScoreChange} · Rejected
            orders: {outcome.rejectedOrders.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 font-mono text-xs md:grid-cols-4">
          <SandboxStat label="Sea State" value={String(outcome.weather.seaState)} />
          <SandboxStat label="Visibility (nm)" value={String(outcome.weather.visibilityNm)} />
          <SandboxStat label="Precipitation" value={outcome.weather.precipitation} />
          <SandboxStat label="Time of Day" value={outcome.weather.timeOfDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Gunnery — Milestone 2</CardTitle>
          <CardDescription>
            {outcome.gunneryResults.length} firing exchanges resolved
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[220px] space-y-1 overflow-auto font-mono text-[12px]">
          {outcome.gunneryResults.length === 0 && (
            <p className="text-muted-foreground">No gunnery exchanges occurred.</p>
          )}
          {outcome.gunneryResults.map((resolution, idx) => (
            <div key={idx} className="border-b pb-1 last:border-0">
              <span className="font-medium">
                [T{resolution.turn}] {resolution.divisionId} → {resolution.targetDivisionId}
              </span>
              {resolution.shots.map((shot, shotIdx) => (
                <div key={shotIdx} className="pl-3 text-muted-foreground">
                  {shot.shooterShipId} → {shot.targetShipId}: {shot.hit ? "HIT" : "miss"} (
                  {shot.armorOutcome})
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            <Waves className="h-4 w-4" />
            Torpedoes, Mines & Submarines — Milestone 3
          </CardTitle>
          <CardDescription>
            {outcome.battleReport.torpedoExpenditure.length} torpedo firings ·{" "}
            {outcome.mineStrikeEvents?.length ?? 0} mine strikes ·{" "}
            {outcome.submarineElementLosses?.reduce((sum, loss) => sum + loss.losses, 0) ?? 0}{" "}
            submarine losses
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 font-mono text-[12px] md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase">Torpedo Expenditure</p>
            {outcome.battleReport.torpedoExpenditure.length === 0 && (
              <p className="text-muted-foreground">None fired.</p>
            )}
            {outcome.battleReport.torpedoExpenditure.map((torpedo, idx) => (
              <div key={idx} className="flex justify-between border-b py-0.5 last:border-0">
                <span>
                  [T{torpedo.turn}] {torpedo.shipId} → {torpedo.targetShipId}
                </span>
                <span className="font-medium">{torpedo.hit ? "HIT" : "miss"}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground uppercase">Mine Strikes</p>
            {(outcome.mineStrikeEvents ?? []).length === 0 && (
              <p className="text-muted-foreground">None.</p>
            )}
            {(outcome.mineStrikeEvents ?? []).map((strike, idx) => (
              <div key={idx} className="flex justify-between border-b py-0.5 last:border-0">
                <span>
                  [T{strike.turn}] {strike.shipId}
                </span>
                <span className="font-medium">{strike.damageState}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
