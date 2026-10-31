import { useEffect, useRef, useState } from "react";
import { decodeLog, encodeLog, type EditLog } from "@bluewave/ship-design";
import { registerAppFlush } from "../../lib/app-flush.js";
import { useBridge } from "../../lib/bridge-context.js";

export const AUTOSAVE_DELAY_MS = 400;
export const DRAFT_RETRY_DELAY_MS = 1_500;

export interface Restored {
  readonly savedAt: string;
}

interface PendingDraft {
  readonly presetId: string;
  readonly log: EditLog;
}

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
  readonly enabled: boolean;
  readonly saveNow: () => boolean;
  readonly saveFailed: boolean;
  readonly unsaved: boolean;
  readonly dismissSaveFailed: () => void;
} {
  const bridge = useBridge();
  const enabled = bridge !== undefined && sessionId !== undefined;
  const [restored, setRestored] = useState<Restored | null>(null);
  const [loaded, setLoaded] = useState(!enabled);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const mounted = useRef(true);
  const pending = useRef<PendingDraft | null>(null);
  const writing = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

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

  const clearRetry = (): void => {
    if (retryTimer.current === null) return;
    clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };

  const scheduleRetry = (delay: number): void => {
    clearRetry();
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      void writeRef.current();
    }, delay);
  };

  const requeue = (next: PendingDraft): void => {
    if (pending.current === null) pending.current = next;
  };

  const write = (): Promise<void> => {
    if (!enabled) return Promise.resolve();
    if (writing.current) return inFlight.current ?? Promise.resolve();
    const next = pending.current;
    if (next === null) return Promise.resolve();
    pending.current = null;
    writing.current = true;
    const draft =
      next.log.edits.length === 0 ? null : { presetId: next.presetId, log: encodeLog(next.log) };
    const attempt = bridge.campaign
      .execute("writeDrawingBoardDraft", { sessionId, draft })
      .then((result) => {
        writing.current = false;
        if (result.outcome === "success") {
          clearRetry();
          if (!mounted.current) return;
          setFailed(false);
          setDismissed(false);
          if (pending.current !== null) scheduleRetry(0);
          return;
        }
        requeue(next);
        if (!mounted.current) return;
        setFailed(true);
        scheduleRetry(DRAFT_RETRY_DELAY_MS);
      })
      .catch(() => {
        writing.current = false;
        requeue(next);
        if (!mounted.current) return;
        setFailed(true);
        scheduleRetry(DRAFT_RETRY_DELAY_MS);
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = attempt;
    return attempt;
  };
  const writeRef = useRef(write);
  writeRef.current = write;

  useEffect(() => {
    if (!enabled || !loaded) return;
    pending.current = { presetId, log };
    scheduleRetry(AUTOSAVE_DELAY_MS);
    return clearRetry;
  }, [enabled, loaded, presetId, log]);

  useEffect(
    () => () => {
      void writeRef.current();
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    return registerAppFlush(() => writeRef.current());
  }, [enabled]);

  const latest = useRef({ presetId, log, loaded });
  latest.current = { presetId, log, loaded };
  const saveNow = () => {
    if (!enabled || !latest.current.loaded) return false;
    pending.current = { presetId: latest.current.presetId, log: latest.current.log };
    void writeRef.current();
    return true;
  };

  return {
    restored,
    dismiss: () => setRestored(null),
    enabled,
    saveNow,
    saveFailed: failed && !dismissed,
    unsaved: failed,
    dismissSaveFailed: () => setDismissed(true),
  };
}
