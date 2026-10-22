import type { ReactNode } from "react";
import { useUiCatalogueSource } from "./useUiCatalogue.js";

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
