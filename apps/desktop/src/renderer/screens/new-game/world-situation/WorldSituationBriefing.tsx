import { useMemo } from "react";
import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import { worldText } from "../world-situation-copy.js";
import { worldSituationSource } from "../world-situation-source.js";
import { buildWorldSituation } from "../world-situation.js";
import { DiplomaticLegend } from "./DiplomaticLegend.js";
import { PowerNavigator } from "./PowerNavigator.js";
import { SelectedPowerDossier } from "./SelectedPowerDossier.js";
import { StrategicSituationSummary, TheaterBoard } from "./StrategicSituationSummary.js";
import { useWorldSituationWorkspace } from "./useWorldSituationWorkspace.js";
import { WorldSituationWorkspaceProvider } from "./WorldSituationWorkspaceProvider.js";

export function WorldSituationBriefing({
  projection,
}: {
  readonly projection: OpeningBriefingProjection;
}) {
  const situation = useMemo(
    () => buildWorldSituation(worldSituationSource(projection)),
    [projection],
  );
  const workspace = useWorldSituationWorkspace({ situation });

  return (
    <WorldSituationWorkspaceProvider workspace={workspace}>
      <div className="flex flex-col gap-6">
        <StrategicSituationSummary situation={situation} />

        {situation.ordered.length === 0 ? (
          <section className="rounded-md border border-dashed border-border p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {worldText("state.empty.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{worldText("state.empty.body")}</p>
          </section>
        ) : (
          <PowerNavigator>
            <SelectedPowerDossier />
          </PowerNavigator>
        )}

        {situation.player.theaters.length === 0 && situation.ordered.length > 0 && (
          <p className="text-sm text-muted-foreground">{worldText("state.noTheaters.body")}</p>
        )}

        <TheaterBoard situation={situation} />

        <DiplomaticLegend />

        <p role="status" className="sr-only">
          {workspace.state.announcement}
        </p>
      </div>
    </WorldSituationWorkspaceProvider>
  );
}
