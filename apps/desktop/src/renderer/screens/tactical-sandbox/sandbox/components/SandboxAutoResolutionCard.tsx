import type { BattleResolution } from "@bluewave/campaign-engine";
import { Sword } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card.js";

export function SandboxAutoResolutionCard({
  resolution,
}: {
  readonly resolution: BattleResolution;
}) {
  return (
    <Card className="border-success/30 bg-success/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-success">
          <Sword className="h-4 w-4" />
          Auto-Resolution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 font-mono text-xs">
        <p>
          Winner:{" "}
          <span className="font-medium">{resolution.missionOutcome.winner ?? "INCONCLUSIVE"}</span>{" "}
          · Outcome: {resolution.missionOutcome.outcomeKind} · War Score:{" "}
          {resolution.warScoreChange}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[12px] uppercase text-muted-foreground">Attacker Ships</p>
            {resolution.attacker.ships.map((ship, idx) => (
              <div
                key={idx}
                className="flex justify-between border-b py-0.5 text-[12px] last:border-0"
              >
                <span>{ship.shipId}</span>
                <span className="font-medium">{ship.outcome}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[12px] uppercase text-muted-foreground">Defender Ships</p>
            {resolution.defender.ships.map((ship, idx) => (
              <div
                key={idx}
                className="flex justify-between border-b py-0.5 text-[12px] last:border-0"
              >
                <span>{ship.shipId}</span>
                <span className="font-medium">{ship.outcome}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
