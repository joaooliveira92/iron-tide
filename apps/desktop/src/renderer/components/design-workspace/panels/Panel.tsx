import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card.js";

export interface PanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** The shared titled card chrome every design-workspace panel is built on. */
export function Panel({ title, children, className }: PanelProps) {
  return (
    <Card className={className} role="region" aria-label={title}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">{children}</CardContent>
    </Card>
  );
}
