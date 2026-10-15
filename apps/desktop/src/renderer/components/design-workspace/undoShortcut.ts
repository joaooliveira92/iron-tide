import type { KeyboardEvent } from "react";

/**
 * Undo/redo for the design: ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y. A text field keeps its own undo. Handles the
 * key (and prevents its default) only when it is one of the shortcuts.
 */
export function handleUndoShortcut(
  e: KeyboardEvent,
  history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  },
): void {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const t = e.target;
  if (
    t instanceof HTMLElement &&
    (t.isContentEditable ||
      (t instanceof HTMLInputElement && t.type !== "checkbox") ||
      t instanceof HTMLTextAreaElement)
  )
    return;
  const key = e.key.toLowerCase();
  const redo = (key === "z" && e.shiftKey) || (key === "y" && !e.shiftKey);
  if (key === "z" && !e.shiftKey) {
    if (history.canUndo) history.undo();
  } else if (redo) {
    if (history.canRedo) history.redo();
  } else return;
  e.preventDefault();
}

const IS_MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
/** The shortcut modifier in the platform's own notation: "⌘" on a Mac, "Ctrl+" elsewhere. */
export const SHORTCUT_MOD = IS_MAC ? "⌘" : "Ctrl+";
/** The shift key in the platform's own notation. */
export const SHORTCUT_SHIFT = IS_MAC ? "⇧" : "Shift+";
