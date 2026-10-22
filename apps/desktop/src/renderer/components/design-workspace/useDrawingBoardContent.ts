import { useEffect, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import { hasDrawingBoardContent, setDrawingBoardContent } from "./content.js";

export type DrawingBoardContentStatus = "loading" | "ready" | "error";

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
