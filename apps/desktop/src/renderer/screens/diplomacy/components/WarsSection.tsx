import { Swords } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { DeferredFeaturesPanel } from "../../../components/shared/DeferredFeaturesPanel.js";
import { GlassSectionCard } from "../../../components/shared/GlassSectionCard.js";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import { DEFERRED_WAR_ITEMS } from "../diplomacy-presentation.js";
import type { DiplomacyWarRow } from "../diplomacy-view-model.js";
import { WarScoreBar } from "./WarScoreBar.js";

export interface WarsSectionProps {
  readonly rows: readonly DiplomacyWarRow[];
  readonly busy: boolean;
  readonly onPeaceAction: (warId: string) => void;
}

export function WarsSection({ rows, busy, onPeaceAction }: WarsSectionProps) {
  return (
    <GlassSectionCard
      icon={<Swords className="h-4 w-4 text-muted-foreground" />}
      title="Wars"
      description="Player-involved wars with war scores, status and dates."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No wars yet</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ war, attackerSideLabel, defenderSideLabel, yourName, enemyName }) => (
            <div key={war.warId} className="rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {DEBUG_MODE && <span className="font-mono text-xs">{war.warId}</span>}
                  <Badge variant={war.status === "ENDED" ? "secondary" : "destructive"}>
                    {war.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {attackerSideLabel} vs {defenderSideLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    score {war.attackerWarScore}:{war.defenderWarScore}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {war.startDate}
                    {war.endDate !== undefined ? ` — ${war.endDate}` : ""}
                  </span>
                  <Badge variant="outline">
                    you: {war.playerSide === "attacker" ? "attacker" : "defender"}
                  </Badge>
                </div>
                {war.status === "ACTIVE" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onPeaceAction(war.warId)}
                  >
                    Accept peace
                  </Button>
                )}
              </div>
              <div className="mt-2">
                <WarScoreBar war={war} yourName={yourName} enemyName={enemyName} />
              </div>
            </div>
          ))}
        </div>
      )}
      <DeferredFeaturesPanel items={DEFERRED_WAR_ITEMS} testId="war-deferred" />
    </GlassSectionCard>
  );
}
