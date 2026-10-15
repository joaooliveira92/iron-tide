import { useEffect, useRef, useState } from "react";
import { decodeLog, encodeLog, type EditLog } from "@bluewave/ship-design";
import { registerAppFlush } from "../../lib/app-flush.js";
import { useBridge } from "../../lib/bridge-context.js";

/** Writes wait this long after the last edit, so typing a value is one write, not one per keystroke. */
export const AUTOSAVE_DELAY_MS = 400;

export interface Restored {
  /** ISO time the restored design was last saved. */
  readonly savedAt: string;
}

/**
 * Keeps the campaign's working design on disk (`drawing-board-draft.json` beside the save): read once when the board
 * opens, then written shortly after every change and when the board closes. Outside a campaign there is nothing to save
 * to, and the board stays a scratch pad.
 */
export function useDraftAutosave({
  sessionId,
  presetId,
  log,
  restore,
}: {
  readonly sessionId: string | undefined;
  readonly presetId: string;
  readonly log: EditLog;
  readonly restore: (presetId: string, log: EditLog) => boolean;
}): {
  readonly restored: Restored | null;
  readonly dismiss: () => void;
  /** True inside a campaign, where the working design is kept on disk. */
  readonly enabled: boolean;
  /** Writes the working design now instead of after the autosave delay; false when there is nowhere to save. */
  readonly saveNow: () => boolean;
} {
  const bridge = useBridge();
  const enabled = bridge !== undefined && sessionId !== undefined;
  const [restored, setRestored] = useState<Restored | null>(null);
  // No write may happen before the read finishes, or the fresh start would overwrite the saved design.
  const [loaded, setLoaded] = useState(!enabled);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void bridge.campaign
      .execute("readDrawingBoardDraft", sessionId)
      .then((r) => {
        if (!live || r.outcome !== "success" || r.value.draft === null) return;
        let saved: EditLog;
        try {
          saved = decodeLog(r.value.draft.log);
        } catch {
          return;
        }
        if (restoreRef.current(r.value.draft.presetId, saved))
          setRestored({ savedAt: r.value.draft.savedAt });
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [enabled, bridge, sessionId]);

  const pending = useRef<{ readonly presetId: string; readonly log: EditLog } | null>(null);
  const write = () => {
    const next = pending.current;
    pending.current = null;
    if (!enabled || next === null) return;
    // An untouched starting design is not worth keeping: remove the file instead.
    const draft =
      next.log.edits.length === 0 ? null : { presetId: next.presetId, log: encodeLog(next.log) };
    void bridge.campaign.execute("writeDrawingBoardDraft", { sessionId, draft }).catch(() => {});
  };
  const writeRef = useRef(write);
  writeRef.current = write;

  useEffect(() => {
    if (!enabled || !loaded) return;
    pending.current = { presetId, log };
    const t = setTimeout(() => writeRef.current(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [enabled, loaded, presetId, log]);
  // Closing the board flushes a write that is still waiting.
  useEffect(() => () => writeRef.current(), []);
  // A bounded quit (Cmd+Q / SIGINT) flushes a write that is still waiting too.
  useEffect(() => {
    if (!enabled) return;
    return registerAppFlush(() => writeRef.current());
  }, [enabled]);

  const latest = useRef({ presetId, log, loaded });
  latest.current = { presetId, log, loaded };
  const saveNow = () => {
    if (!enabled || !latest.current.loaded) return false;
    pending.current = { presetId: latest.current.presetId, log: latest.current.log };
    writeRef.current();
    return true;
  };

  return { restored, dismiss: () => setRestored(null), enabled, saveNow };
}
