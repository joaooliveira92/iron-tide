import { useEffect, useState } from "react";
import { useBridge } from "../lib/bridge-context.js";
import { hasUiCatalogue, setUiCatalogue } from "./uiCatalogue.js";

export type UiCatalogueStatus = "loading" | "ready" | "error";

/**
 * Fetches the decoded UI-string catalogue from main over the narrow
 * `inspectUiCatalogue` IPC, once, and injects it into the synchronous seam the
 * summary surfaces read (`uiCatalogue.ts`). Tests that pre-seed a catalogue skip
 * the fetch. With no bridge and no injected catalogue it fails closed.
 */
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
