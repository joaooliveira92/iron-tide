import { useEffect, useState } from "react";
import { useBridge } from "../lib/bridge-context.js";
import { hasUiCatalogue, setUiCatalogue } from "./uiCatalogue.js";

export type UiCatalogueStatus = "loading" | "ready" | "error";

export function useUiCatalogueSource(): UiCatalogueStatus {
  const bridge = useBridge();
  const [status, setStatus] = useState<UiCatalogueStatus>(() =>
    hasUiCatalogue() ? "ready" : "loading",
  );

  useEffect(() => {
    if (hasUiCatalogue()) {
      setStatus("ready");
      return;
    }
    if (bridge === undefined) {
      setStatus("error");
      return;
    }
    let active = true;
    void bridge.campaign
      .execute("inspectUiCatalogue", undefined)
      .then((result) => {
        if (!active) return;
        if (result.outcome === "success") {
          setUiCatalogue(result.value);
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
