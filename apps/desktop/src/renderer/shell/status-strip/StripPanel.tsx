import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";

export interface StripPanelProps {
  readonly name: string;
  readonly aside?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function StripPanel({ name, aside, actions, className, children }: StripPanelProps) {
  return (
    <div
      role="group"
      aria-label={name}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold leading-5 tracking-tight">
          <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-admiralty-accent" />
          {name}
        </h2>
        {aside !== undefined && (
          <span title={aside} className="truncate text-xs font-medium text-muted-foreground">
            {aside}
          </span>
        )}
        {actions}
      </div>
      <div className="flex-1 px-2.5 py-2">{children}</div>
    </div>
  );
}
