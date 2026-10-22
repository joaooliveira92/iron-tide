import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card.js";

export interface PanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly compact?: boolean;
}

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
