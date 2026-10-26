import type { ReactElement, ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { SlateBody, SlateFacts, SlateFoot, SlateHeader } from "../../../components/ui/slate.js";

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
        className={cn("w-72", className)}
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
    <>
      <SlateHeader title={title} />
      <SlateBody>
        <SlateFacts rows={rows} />
      </SlateBody>
      {note !== undefined && <SlateFoot>{note}</SlateFoot>}
    </>
  );
}
