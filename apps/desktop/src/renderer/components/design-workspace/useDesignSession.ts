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

/** Technology dates offered outside a campaign (inside one the campaign month is fixed). */
export const TECHNOLOGY_MONTHS = [
  "1885-01",
  "1890-01",
  "1893-06",
  "1895-06",
  "1896-01",
  "1899-12",
] as const;

/** The technology dates to offer: the fixed list plus the current one, in order. */
export function technologyMonths(current: string): string[] {
  return [...new Set<string>([...TECHNOLOGY_MONTHS, current])].sort();
}

/**
 * The key an edit's inline error is filed under: the edit kind plus the setting it changes, so a field can ask for
 * `set_hull:materialId`; an armour region is filed as `set_armour_region:<region>`.
 */
export function editField(e: DraftEdit): string {
  // An armour edit carries the whole region, so the error is filed per region.
  if (e.kind === "set_armour_region") return `${e.kind}:${e.region.region}`;
  const patch = "patch" in e ? Object.keys(e.patch)[0] : undefined;
  return patch === undefined ? e.kind : `${e.kind}:${patch}`;
}

/**
 * Everything a designer host wires around the draft, whatever its layout: the undoable draft and its compile, the
 * findings shared by drawing and inspector, the presentation selection (pruned as the design changes), and loading
 * another design behind a confirmation once there are edits to lose.
 */
export function useDesignSession(fixedMonth: string | null) {
  const { state, actions: boardActions } = useDrawingBoard(fixedMonth);
  const format = usePresentationFormat();
  const { draft, view, content, env } = state;
  const zones = content.hullForms.find((f) => f.id === draft.hull.hullFormId)?.zones ?? [];
  const batteries = useMemo(() => batteryCards(view, draft), [view, draft]);
  // One finding list per compile, shared by the drawing, the inspector and the findings list.
  const findings = useMemo(() => boardFindings(view, draft, batteries), [view, draft, batteries]);
  // Every edit is watched: one that introduces a blocking or critical finding is explained at once, whichever panel made it.
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
  // Presentation selection (pinned, form-linked, hover preview): one store per host, never design state.
  const [selection] = useState(createSelectionStore);
  useEffect(() => selection.prune((e) => entityExists(e, draft, zones)), [selection, draft, zones]);
  // A resolved finding drops out of the selection; its entity stays pinned while it exists.
  useEffect(
    () => selection.pruneFinding((key) => findings.some((f) => f.key === key)),
    [selection, findings],
  );
  // Another ship replaces everything the selection could point at.
  const loadPreset = (id: string) => {
    selection.clear();
    actions.loadPreset(id);
  };
  const loadDraft = (d: DesignDraft) => {
    selection.clear();
    actions.loadDraft(d);
  };
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  /** Loads a starting design at once, or asks first when it would throw edits away. */
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
  const armourMaterials = armourMaterialOptions(
    env.ctx.balance.armour,
    state.month,
    env.ctx.unlockedTechs,
  );
  return {
    state,
    actions,
    env,
    zones,
    batteries,
    findings,
    /** The explanation of the last edit that broke the design; render it once with `ChoiceProblemDialog`. */
    choiceCheck,
    selection,
    loadPreset,
    loadDraft,
    requestPreset,
    /** The starting design waiting for the player to confirm replacing their work, if any. */
    pendingPreset,
    setPendingPreset,
    starters,
    armourMaterials,
  };
}

export type DesignSession = ReturnType<typeof useDesignSession>;
