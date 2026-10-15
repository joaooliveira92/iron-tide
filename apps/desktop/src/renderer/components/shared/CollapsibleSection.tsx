import type { ReactNode } from "react";

export interface CollapsibleSectionProps {
  readonly title: string;
  readonly testId: string;
  /** Short count or status shown beside the title, e.g. "3 lost". */
  readonly summary?: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/** A native <details> section: keyboard-accessible and keeps long screens scannable. */
export function CollapsibleSection({
  title,
  testId,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  return (
    <details className="group rounded-md border px-4 py-3" open={defaultOpen} data-testid={testId}>
      <summary className="cursor-pointer text-sm font-medium">
        {title}
        {summary !== undefined && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">{summary}</span>
        )}
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}
