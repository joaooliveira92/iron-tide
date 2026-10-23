import type { ReactElement, ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";

export interface PeekProps {
  readonly trigger: ReactElement;
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  readonly className?: string;
}

export function Peek({ trigger, children, side = "top", align = "center", className }: PeekProps) {
  return (
    <HoverCard>
      <HoverCardTrigger delay={140} closeDelay={60} render={trigger} />
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn("w-72 p-3", className)}
      >
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}

export interface PeekRow {
  readonly label: string;
  readonly value: string;
}

export function PeekRows({
  title,
  rows,
  note,
}: {
  readonly title: string;
  readonly rows: readonly PeekRow[];
  readonly note?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-xs font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {note !== undefined && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
