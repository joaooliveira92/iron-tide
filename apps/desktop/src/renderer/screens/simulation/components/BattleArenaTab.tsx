import type {
  BattleManifest,
  BattleResolution,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";
import { Sword, Swords } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { BattleManifestView } from "./BattleManifestView.js";
import { BattleResolutionPanel } from "./BattleResolutionPanel.js";
import { ErrorAlert } from "./ErrorAlert.js";

interface BattleArenaTabProps {
  readonly battleManifest: BattleManifest | null;
  readonly battleLoading: boolean;
  readonly battleError: string | null;
  readonly autoResolution: BattleResolution | null;
  readonly tacticalOutcome: TacticalBattleOutcome | null;
  readonly playerNationId: string | null;
  readonly onGenerateBattle: () => void;
  readonly onAutoResolve: () => void;
  readonly onTacticalResolve: () => void;
}

export function BattleArenaTab({
  battleManifest,
  battleLoading,
  battleError,
  autoResolution,
  tacticalOutcome,
  playerNationId,
  onGenerateBattle,
  onAutoResolve,
  onTacticalResolve,
}: BattleArenaTabProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 font-semibold">
          <Sword className="h-4 w-4 text-primary" />
          Deterministic Battle Simulation Arena
        </CardTitle>
        <CardDescription className="text-[11pt]">
          Generate tactical engagements based on ongoing wars and resolve them
          deterministic-seeding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ButtonGroup>
          <Button variant="secondary" size="sm" onClick={onGenerateBattle} disabled={battleLoading}>
            Generate Engagement
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAutoResolve}
            disabled={battleLoading || battleManifest === null}
          >
            Auto-Resolve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onTacticalResolve}
            disabled={battleLoading || battleManifest === null}
          >
            Run Tactical resolver (200t)
          </Button>
        </ButtonGroup>

        {battleLoading && (
          <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" />
            Running battle simulator engines…
          </div>
        )}

        {battleError !== null && <ErrorAlert message={battleError} fontMono />}

        {battleManifest === null && !battleLoading ? (
          <Empty>
            <EmptyIcon>
              <Swords />
            </EmptyIcon>
            <EmptyTitle>No engagement generated</EmptyTitle>
            <EmptyDescription>
              Generate an engagement from an active war to begin resolving it.
            </EmptyDescription>
          </Empty>
        ) : (
          battleManifest !== null && (
            <BattleManifestView manifest={battleManifest} playerNationId={playerNationId} />
          )
        )}

        <BattleResolutionPanel autoResolution={autoResolution} tacticalOutcome={tacticalOutcome} />
      </CardContent>
    </Card>
  );
}
