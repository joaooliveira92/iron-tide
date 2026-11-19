import { useBridge } from "../lib/bridge-context.js";
import { useStoreLifecycle } from "../lib/use-store-lifecycle.js";
import { hasUiCatalogue, setUiCatalogue } from "./uiCatalogue.js";

export type UiCatalogueStatus = "loading" | "ready" | "error";

export function useUiCatalogueSource(): UiCatalogueStatus {
  const bridge = useBridge();
  const [status] = useStoreLifecycle<UiCatalogueStatus>(
    () => (hasUiCatalogue() ? "ready" : "loading"),
    (target) => {
      if (hasUiCatalogue()) {
        target.set("ready");
        return;
      }
      if (bridge === undefined) {
        target.set("error");
        return;
      }
      let active = true;
      void bridge.campaign
        .execute("inspectUiCatalogue", undefined)
        .then((result) => {
          if (!active) return;
          if (result.outcome === "success") {
            setUiCatalogue(result.value);
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
