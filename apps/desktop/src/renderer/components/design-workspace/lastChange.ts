import type { DesignDraft, DraftEdit, EditLog, WorkshopView } from "@bluewave/ship-design";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { diffViews, type DesignFeedback } from "./designFeedback.js";

export type LastChangeKind = "edit" | "undo" | "redo";

export interface LastChange {
  readonly kind: LastChangeKind;
  readonly label: string;
  readonly feedback: DesignFeedback;
}

export interface Snapshot {
  readonly log: EditLog;
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
}

export type Describe = (edit: DraftEdit, draftBefore: DesignDraft) => string;

const PREFIX: Readonly<Record<LastChangeKind, string>> = {
  edit: "",
  undo: "Undid: ",
  redo: "Redid: ",
};

function stepOf(prev: EditLog, next: EditLog): { kind: LastChangeKind; edit: DraftEdit } | null {
  if (prev === next) return null;
  if (prev.edits === next.edits) {
    if (next.cursor === prev.cursor - 1) {
      const edit = prev.edits[next.cursor];
      return edit === undefined ? null : { kind: "undo", edit };
    }
    if (next.cursor === prev.cursor + 1) {
      const edit = next.edits[prev.cursor];
      return edit === undefined ? null : { kind: "redo", edit };
    }
    return null;
  }
  if (next.base !== prev.base || next.cursor !== prev.cursor + 1) return null;
  for (let i = 0; i < prev.cursor; i++) if (next.edits[i] !== prev.edits[i]) return null;
  const edit = next.edits[prev.cursor];
  return edit === undefined ? null : { kind: "edit", edit };
}

export function deriveLastChange(
  prev: Snapshot,
  next: Snapshot,
  describe: Describe,
  format: PresentationFormat,
): LastChange | null {
  const step = stepOf(prev.log, next.log);
  if (step === null) return null;
  const before = step.kind === "undo" ? next : prev;
  return {
    kind: step.kind,
    label: `${PREFIX[step.kind]}${describe(step.edit, before.draft)}`,
    feedback: diffViews(prev.view, next.view, format),
  };
}
