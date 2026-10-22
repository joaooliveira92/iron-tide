import { useMemo, useState } from "react";
import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import { attitudeLabel, outlookLabel, statusLabel, worldText } from "../world-situation-copy.js";
import { worldSituationSource } from "../world-situation-source.js";
import { buildWorldSituation } from "../world-situation.js";
import { DiplomaticLegend } from "./DiplomaticLegend.js";
import { PowerNavigator } from "./PowerNavigator.js";
import { SelectedPowerDossier, dossierAnnouncement } from "./SelectedPowerDossier.js";
import { StrategicSituationSummary, TheaterBoard } from "./StrategicSituationSummary.js";

export function WorldSituationBriefing({
  projection,
}: {
  readonly projection: OpeningBriefingProjection;
}) {
  const situation = useMemo(
    () => buildWorldSituation(worldSituationSource(projection)),
    [projection],
  );
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const selected =
    situation.ordered.find((power) => power.nationId === chosenId) ??
    situation.ordered.find((power) => power.nationId === situation.defaultSelectionId) ??
    null;

  const select = (nationId: string) => {
    setChosenId(nationId);
    const power = situation.ordered.find((candidate) => candidate.nationId === nationId);
    if (power === undefined) return;
    setAnnouncement(
      dossierAnnouncement(power, {
        status: statusLabel(power.status),
        attitude: attitudeLabel(power.attitude),
        outlook: outlookLabel(power.outlook),
      }),
    );
  };

  return (
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
        <PowerNavigator
          groups={situation.groups}
          selectedId={selected?.nationId ?? null}
          onSelect={select}
          renderDossier={(power) => <SelectedPowerDossier power={power} />}
        />
      )}

      {situation.player.theaters.length === 0 && situation.ordered.length > 0 && (
        <p className="text-sm text-muted-foreground">{worldText("state.noTheaters.body")}</p>
      )}

      <TheaterBoard situation={situation} />

      <DiplomaticLegend />

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
