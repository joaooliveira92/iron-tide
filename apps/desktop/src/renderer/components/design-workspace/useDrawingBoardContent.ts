import { useEffect, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import { hasDrawingBoardContent, setDrawingBoardContent } from "./content.js";

export type DrawingBoardContentStatus = "loading" | "ready" | "error";

/**
 * Fetches the decoded drawing-board content from the main process over the
 * narrow `inspectDrawingBoardContent` IPC, once, and injects it into the
 * synchronous loader the board reads (see `content.ts`).
 *
 * Tests (and any embedding that pre-seeds content) skip the fetch: if the
 * content is already injected, the status is `ready` immediately. With no
 * bridge and no injected content the board fails closed (`error`) rather than
 * rendering unvalidated content.
 */
export function useDrawingBoardContentSource(): DrawingBoardContentStatus {
  const bridge = useBridge();
  const [status, setStatus] = useState<DrawingBoardContentStatus>(() =>
    hasDrawingBoardContent() ? "ready" : "loading",
  );

  useEffect(() => {
    if (hasDrawingBoardContent()) {
      setStatus("ready");
      return;
    }
    if (bridge === undefined) {
      setStatus("error");
      return;
    }
    let active = true;
    void bridge.campaign
      .execute("inspectDrawingBoardContent", undefined)
      .then((result) => {
        if (!active) return;
        if (result.outcome === "success") {
          setDrawingBoardContent(result.value);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [bridge]);

  return status;
}
