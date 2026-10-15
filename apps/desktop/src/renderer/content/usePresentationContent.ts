import { useEffect, useState } from "react";
import { useBridge } from "../lib/bridge-context.js";
import { hasPresentationContent, setPresentationContent } from "./presentationContent.js";

export type PresentationContentStatus = "loading" | "ready" | "error";

/**
 * Fetches the decoded presentation corpus from the main process over the narrow
 * `inspectPresentationContent` IPC, once, and injects it into the synchronous
 * seam the screens read (see `presentationContent.ts`). Mirrors the drawing
 * board's content source. Tests (and any embedding that pre-seeds content) skip
 * the fetch: if the content is already injected, the status is `ready`
 * immediately. With no bridge and no injected content it fails closed (`error`)
 * rather than rendering unvalidated content.
 */
export function usePresentationContentSource(): PresentationContentStatus {
  const bridge = useBridge();
  const [status, setStatus] = useState<PresentationContentStatus>(() =>
    hasPresentationContent() ? "ready" : "loading",
  );

  useEffect(() => {
    if (hasPresentationContent()) {
      setStatus("ready");
      return;
    }
    if (bridge === undefined) {
      setStatus("error");
      return;
    }
    let active = true;
    void bridge.campaign
      .execute("inspectPresentationContent", undefined)
      .then((result) => {
        if (!active) return;
        if (result.outcome === "success") {
          setPresentationContent(result.value);
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
