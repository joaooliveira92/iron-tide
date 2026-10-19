import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card.js";

export interface PanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  /**
   * Drop the visible heading and tighten the padding, for a panel that sits under a toolbar already naming it. The
   * region keeps its accessible name.
   */
  readonly compact?: boolean;
}

/** The shared titled card chrome every design-workspace panel is built on. */
export function Panel({ title, children, className, compact = false }: PanelProps) {
  return (
    <Card className={className} role="region" aria-label={title}>
      {!compact && (
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "space-y-2 p-0" : "space-y-3 p-4 pt-0"}>
        {children}
      </CardContent>
    </Card>
  );
}
