import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card.js";

export interface PanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly compact?: boolean;
  readonly hideTitle?: boolean;
}

export function Panel({
  title,
  children,
  className,
  compact = false,
  hideTitle = false,
}: PanelProps) {
  return (
    <Card className={className} role="region" aria-label={title}>
      {!compact && !hideTitle && (
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent
        className={compact ? "space-y-2 p-0" : hideTitle ? "space-y-3 p-4" : "space-y-3 p-4 pt-0"}
      >
        {children}
      </CardContent>
    </Card>
  );
}
