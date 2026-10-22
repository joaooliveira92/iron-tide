import type { ReactNode } from "react";
import { useUiCatalogueSource } from "./useUiCatalogue.js";

/**
 * Loads the compiled UI-string catalogue from main before any surface that
 * resolves a message renders (ADR-0209/ADR-0218). Without it every offer, battle
 * and turn string would show the generic fallback. In tests the catalogue is
 * pre-seeded, so the gate is ready immediately; in the app it shows a brief
 * status and fails closed if the catalogue never arrives.
 */
export function UiCatalogueGate({ children }: { readonly children: ReactNode }) {
  const status = useUiCatalogueSource();
  if (status === "ready") return <>{children}</>;
  if (status === "error") {
    return (
      <div className="p-8">
        <p role="alert" className="text-sm text-destructive">
          Could not load the interface text from the campaign service.
        </p>
      </div>
    );
  }
  return (
    <div className="p-8">
      <p role="status" className="text-sm text-muted-foreground">
        Loading interface text…
      </p>
    </div>
  );
}
