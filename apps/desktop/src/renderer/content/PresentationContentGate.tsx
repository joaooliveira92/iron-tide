import type { ReactNode } from "react";
import { usePresentationContentSource } from "./usePresentationContent.js";

export function PresentationContentGate({ children }: { readonly children: ReactNode }) {
  const status = usePresentationContentSource();
  if (status === "ready") return <>{children}</>;
  if (status === "error") {
    return (
      <div className="p-8">
        <p role="alert" className="text-sm text-destructive">
          Could not load nation presentation content from the campaign service.
        </p>
      </div>
    );
  }
  return (
    <div className="p-8">
      <p role="status" className="text-sm text-muted-foreground">
        Loading nation presentation content…
      </p>
    </div>
  );
}
