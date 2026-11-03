import { useCallback, useMemo, useState } from "react";
import { attitudeLabel, outlookLabel, statusLabel, worldText } from "../world-situation-copy.js";
import type { PowerBrief, WorldSituation } from "../world-situation.js";

export interface WorldSituationWorkspaceInput {
  readonly situation: WorldSituation;
}

export interface WorldSituationWorkspaceState {
  readonly chosenId: string | null;
  readonly announcement: string;
}

export interface WorldSituationWorkspaceActions {
  readonly selectPower: (nationId: string) => void;
}

export interface WorldSituationWorkspaceMeta {
  readonly situation: WorldSituation;
  readonly selectedId: string | null;
  readonly selected: PowerBrief | null;
}

export interface WorldSituationWorkspace {
  readonly state: WorldSituationWorkspaceState;
  readonly actions: WorldSituationWorkspaceActions;
  readonly meta: WorldSituationWorkspaceMeta;
}

export function useWorldSituationWorkspace({
  situation,
}: WorldSituationWorkspaceInput): WorldSituationWorkspace {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const selected =
    situation.ordered.find((power) => power.nationId === chosenId) ??
    situation.ordered.find((power) => power.nationId === situation.defaultSelectionId) ??
    null;
  const selectedId = selected?.nationId ?? null;

  const selectPower = useCallback(
    (nationId: string) => {
      setChosenId(nationId);
      const power = situation.ordered.find((candidate) => candidate.nationId === nationId);
      if (power === undefined) return;
      setAnnouncement(
        worldText("dossier.announce", {
          power: power.name,
          status: statusLabel(power.status),
          attitude: attitudeLabel(power.attitude),
          outlook: outlookLabel(power.outlook),
        }),
      );
    },
    [situation],
  );

  const state = useMemo<WorldSituationWorkspaceState>(
    () => ({ chosenId, announcement }),
    [chosenId, announcement],
  );

  const actions = useMemo<WorldSituationWorkspaceActions>(() => ({ selectPower }), [selectPower]);

  const meta = useMemo<WorldSituationWorkspaceMeta>(
    () => ({ situation, selectedId, selected }),
    [situation, selectedId, selected],
  );

  return { state, actions, meta };
}
