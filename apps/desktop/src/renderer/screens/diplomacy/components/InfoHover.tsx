import type { ReactElement } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { SlateBody, SlateFacts, SlateHeader } from "../../../components/ui/slate.js";

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
      <HoverCardContent side={side} align="center" sideOffset={8}>
        <SlateHeader title={title} />
        <SlateBody>
          <SlateFacts rows={rows} />
        </SlateBody>
      </HoverCardContent>
    </HoverCard>
  );
}
