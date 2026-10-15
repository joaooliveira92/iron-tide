import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildWorkshopView,
  generateCandidates,
  suggestFixes,
  type Candidate,
  type SuggestedFix,
  canRedo,
  canUndo,
  currentDraft,
  EditError,
  newLog,
  pushEdit,
  redo,
  undo,
  type DraftEdit,
  type DesignDraft,
  type EditLog,
  type WorkshopView,
} from "@bluewave/ship-design";
import {
  loadDrawingBoardContent,
  type DrawingBoardContent,
  type ReferenceDesign,
} from "./content.js";
import { selectInitialReference } from "./initialReference.js";

export interface DrawingBoardState {
  readonly content: DrawingBoardContent;
  readonly preset: ReferenceDesign;
  readonly month: string;
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  /** The starting design compiled under the same rules, for the "developed from" comparison. */
  readonly baseline: WorkshopView;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Last rejected edit, shown to the player instead of failing silently. */
  readonly editError: string | null;
  readonly editCount: number;
  /** Every edit in the log (applied ones first), for the history list. */
  readonly history: readonly DraftEdit[];
  /** The whole undoable log, for saving the working design. */
  readonly log: EditLog;
}

export interface DrawingBoardActions {
  readonly edit: (e: DraftEdit) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  /** Moves the history cursor: 0 = starting design, n = after the n-th edit. */
  readonly jumpTo: (cursor: number) => void;
  readonly loadPreset: (id: string) => void;
  readonly setMonth: (month: string) => void;
  /** Previews candidate edits by recompiling; call on demand, not on every render. */
  readonly suggest: () => SuggestedFix[];
  /** Runs the same-rules AI designer from the current draft; call on demand (a second or two of work). */
  readonly generateAlternatives: () => Candidate[];
  /** Replaces the working design (and its history) with another draft, e.g. an AI candidate. */
  readonly loadDraft: (draft: DesignDraft) => void;
  /** Puts back a saved working design: its starting design and its whole edit log. False if the start no longer exists. */
  readonly restore: (presetId: string, log: EditLog) => boolean;
}

/** Local-only designer state: an undoable edit log over a draft, recompiled for display after every change. */
export function useDrawingBoard(fixedMonth: string | null = null): {
  state: DrawingBoardState;
  actions: DrawingBoardActions;
} {
  const content = useMemo(() => loadDrawingBoardContent(), []);
  // In a campaign start from the newest reference design that exists at the campaign date (see selectInitialReference).
  const initial = selectInitialReference(content.references, fixedMonth) ?? content.references[0]!;
  const [preset, setPreset] = useState<ReferenceDesign>(initial);
  const [log, setLog] = useState<EditLog>(() => newLog(initial.draft));
  const [chosenMonth, setMonthState] = useState(content.references[0]!.month);
  // Inside a campaign the rules date is the campaign month: technology availability must match what the engine will use.
  const month = fixedMonth ?? chosenMonth;
  const [editError, setEditError] = useState<string | null>(null);

  const logRef = useRef(log);
  const commit = useCallback((next: EditLog) => {
    logRef.current = next;
    setLog(next);
  }, []);

  const draft = useMemo(() => currentDraft(log), [log]);
  // The board designs for the draft's nation: its catalogue, capabilities and identity brief come from the profile.
  const env = useMemo(
    () => content.environmentFor(month, draft.nationId),
    [content, month, draft.nationId],
  );
  const view = useMemo(() => buildWorkshopView(draft, env), [draft, env]);

  const baseline = useMemo(() => buildWorkshopView(preset.draft, env), [preset, env]);

  const edit = useCallback(
    (e: DraftEdit) => {
      try {
        commit(pushEdit(logRef.current, e));
        setEditError(null);
      } catch (err) {
        setEditError(EditError.is(err) ? err.message : String(err));
      }
    },
    [commit],
  );

  return {
    state: {
      content,
      preset,
      month,
      draft,
      view,
      baseline,
      canUndo: canUndo(log),
      canRedo: canRedo(log),
      editError,
      editCount: log.cursor,
      history: log.edits,
      log,
    },
    actions: {
      edit,
      undo: () => commit(undo(logRef.current)),
      redo: () => commit(redo(logRef.current)),
      jumpTo: (cursor) => {
        const l = logRef.current;
        commit({ ...l, cursor: Math.max(0, Math.min(l.edits.length, cursor)) });
      },
      loadPreset: (id) => {
        const p = content.references.find((r) => r.id === id);
        if (!p) return;
        setPreset(p);
        commit(newLog(p.draft));
        if (fixedMonth === null) setMonthState(p.month);
        setEditError(null);
      },
      setMonth: setMonthState,
      suggest: () => suggestFixes(draft, env.ctx, 5, view.compiled),
      generateAlternatives: () =>
        generateCandidates(content.aiEnvironmentFor(month, draft.nationId), {
          base: draft,
          seed: `drawing-board:${view.compiled.hash.slice(0, 16)}`,
          nationKey: draft.nationId,
          candidates: 4,
          compilesPerArchetype: 50,
        }).candidates as Candidate[],
      loadDraft: (d) => {
        commit(newLog(d));
        setEditError(null);
      },
      restore: (presetId, saved) => {
        const p = content.references.find((r) => r.id === presetId);
        if (!p) return false;
        try {
          currentDraft(saved);
        } catch {
          return false; // an edit no longer applies to this content: keep the fresh start
        }
        setPreset(p);
        commit(saved);
        if (fixedMonth === null) setMonthState(p.month);
        setEditError(null);
        return true;
      },
    },
  };
}
