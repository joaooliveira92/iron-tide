import { useEffect, useRef } from "react";
import { dismissToast, toast } from "../ui/toast.js";
import type { Restored } from "./useDraftAutosave.js";

const RESTORED_TOAST_ID = "drawing-board-restored";

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
