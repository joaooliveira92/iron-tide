import { useEffect, useRef } from "react";
import { dismissToast, toast } from "../ui/toast.js";
import type { Restored } from "./useDraftAutosave.js";

/** Stable id so re-restoring the same draft updates the toast instead of stacking another. */
const RESTORED_TOAST_ID = "drawing-board-restored";

/**
 * Announces a restored working design as a bottom-right toast (not a page banner) carrying the two choices: keep
 * working, or start over from the starting design.
 */
export function useRestoredDraftToast({
  restored,
  dismiss,
  startOver,
}: {
  readonly restored: Restored | null;
  readonly dismiss: () => void;
  readonly startOver: () => void;
}): void {
  const latest = useRef({ dismiss, startOver });
  latest.current = { dismiss, startOver };
  useEffect(() => {
    if (restored === null) return;
    // Bound when the toast appears: "Start over" returns to the design that was restored, even after another loads.
    const { dismiss: close, startOver: restart } = latest.current;
    const id = toast(
      `Your unsubmitted design was restored, with its edit history (last changed ${new Date(
        restored.savedAt,
      ).toLocaleString()}). Changes are saved as you work.`,
      {
        id: RESTORED_TOAST_ID,
        duration: 0,
        onClose: close,
        cancel: { label: "Keep working", onClick: () => {} },
        action: {
          label: "Start over",
          onClick: () => {
            close();
            restart();
          },
        },
      },
    );
    return () => dismissToast(id);
  }, [restored]);
}
