import { useBridge } from "../lib/bridge-context.js";
import { useStoreLifecycle } from "../lib/use-store-lifecycle.js";
import { hasPresentationContent, setPresentationContent } from "./presentationContent.js";

export type PresentationContentStatus = "loading" | "ready" | "error";

export function usePresentationContentSource(): PresentationContentStatus {
  const bridge = useBridge();
  const [status] = useStoreLifecycle<PresentationContentStatus>(
    () => (hasPresentationContent() ? "ready" : "loading"),
    (target) => {
      if (hasPresentationContent()) {
        target.set("ready");
        return;
      }
      if (bridge === undefined) {
        target.set("error");
        return;
      }
      let active = true;
      void bridge.campaign
        .execute("inspectPresentationContent", undefined)
        .then((result) => {
          if (!active) return;
          if (result.outcome === "success") {
            setPresentationContent(result.value);
            target.set("ready");
          } else {
            target.set("error");
          }
        })
        .catch(() => {
          if (active) target.set("error");
        });
      return () => {
        active = false;
      };
    },
    [bridge],
  );

  return status;
}
