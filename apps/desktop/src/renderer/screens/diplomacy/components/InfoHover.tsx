import type { ReactElement } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";

export interface InfoHoverRow {
  readonly label: string;
  readonly value: string;
}

export interface InfoHoverProps {
  readonly title: string;
  readonly rows: readonly InfoHoverRow[];
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly children: ReactElement;
}

export function InfoHover({ title, rows, side = "top", children }: InfoHoverProps) {
  return (
    <HoverCard>
      <HoverCardTrigger delay={120} closeDelay={60} render={children} />
      <HoverCardContent side={side} align="center" sideOffset={8} className="w-64 p-3">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <dl className="space-y-1">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-xs font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}
