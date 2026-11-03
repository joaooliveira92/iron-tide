import { useCallback, useEffect, useMemo, useState } from "react";
import { armourMaterialOptions, type DesignDraft, type DraftEdit } from "@bluewave/ship-design";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { batteryCards } from "./batteryView.js";
import { entityExists } from "./selection/facts.js";
import { createSelectionStore } from "./selection/store.js";
import { boardFindings } from "./validation/boardFindings.js";
import { describeEdit } from "./describeEdit.js";
import { useChoiceCheck } from "./useChoiceCheck.js";
import { useDrawingBoard } from "./useDrawingBoard.js";

export const TECHNOLOGY_MONTHS = [
  "1885-01",
  "1890-01",
  "1893-06",
  "1895-06",
  "1896-01",
  "1899-12",
] as const;

export function technologyMonths(current: string): string[] {
  return [...new Set<string>([...TECHNOLOGY_MONTHS, current])].sort();
}

export function editField(e: DraftEdit): string {
  if (e.kind === "set_armour_region") return `${e.kind}:${e.region.region}`;
  const patch = "patch" in e ? Object.keys(e.patch)[0] : undefined;
  return patch === undefined ? e.kind : `${e.kind}:${patch}`;
}

export function useDesignSession(fixedMonth: string | null) {
  const { state, actions: boardActions } = useDrawingBoard(fixedMonth);
  const format = usePresentationFormat();
  const { draft, view, content, env } = state;
  const zones = content.hullForms.find((f) => f.id === draft.hull.hullFormId)?.zones ?? [];
  const batteries = useMemo(() => batteryCards(view, draft), [view, draft]);
  const findings = useMemo(() => boardFindings(view, draft, batteries), [view, draft, batteries]);
  const choiceCheck = useChoiceCheck(findings);
  const { guard } = choiceCheck;
  const boardEdit = boardActions.edit;
  const edit = useCallback(
    (e: DraftEdit) =>
      guard(
        editField(e),
        describeEdit(e, (id) => id.replaceAll("_", " "), format),
        () => boardEdit(e),
      ),
    [guard, boardEdit, format],
  );
  const actions = useMemo(() => ({ ...boardActions, edit }), [boardActions, edit]);
  const [selection] = useState(createSelectionStore);
  useEffect(() => selection.prune((e) => entityExists(e, draft, zones)), [selection, draft, zones]);
  useEffect(
    () => selection.pruneFinding((key) => findings.some((f) => f.key === key)),
    [selection, findings],
  );
  const loadPreset = (id: string) => {
    selection.clear();
    actions.loadPreset(id);
  };
  const loadDraft = (d: DesignDraft) => {
    selection.clear();
    actions.loadDraft(d);
  };
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const requestPreset = (id: string) =>
    state.editCount > 0 ? setPendingPreset(id) : loadPreset(id);
  const starters = useMemo(
    () =>
      content.references.flatMap((r) =>
        r.starterFor === undefined
          ? []
          : [{ id: r.id, name: r.name, month: r.month, starterFor: r.starterFor, draft: r.draft }],
      ),
    [content],
  );
  const armourMaterials = useMemo(
    () => armourMaterialOptions(env.ctx.balance.armour, state.month, env.ctx.unlockedTechs),
    [env, state.month],
  );
  return {
    state,
    actions,
    env,
    zones,
    batteries,
    findings,
    choiceCheck,
    selection,
    loadPreset,
    loadDraft,
    requestPreset,
    pendingPreset,
    setPendingPreset,
    starters,
    armourMaterials,
  };
}

export type DesignSession = ReturnType<typeof useDesignSession>;
