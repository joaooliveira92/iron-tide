import type { ReactNode } from "react";
import { usePresentationContentSource } from "./usePresentationContent.js";

/**
 * Loads the decoded presentation corpus from main over the content-query IPC
 * before any screen that reads it renders (CAH-PRES-3). In tests the corpus is
 * already injected from the compiled artifact, so the gate is ready
 * immediately; in the app it renders a brief status until the DTO arrives, and
 * fails closed if it never does.
 */
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
