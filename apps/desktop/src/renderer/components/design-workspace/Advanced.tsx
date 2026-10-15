import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

/**
 * Progressive disclosure: the specialist controls a section offers beyond the ones a valid design needs. Closed by
 * default, so a section opens with only its primary fields, and its summary is reachable by keyboard and screen reader.
 */
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
