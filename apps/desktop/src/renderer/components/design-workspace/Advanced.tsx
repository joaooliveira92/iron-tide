import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export function Advanced({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <details className={cn("rounded-md border p-2", className)}>
      <summary className="cursor-pointer text-xs text-muted-foreground">Advanced</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
