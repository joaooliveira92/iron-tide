import type { ReactElement } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";

export function IconTip({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactElement;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger delay={150} render={children} />
      <HoverCardContent side="top" className="w-auto px-2 py-1 text-xs">
        {label}
      </HoverCardContent>
    </HoverCard>
  );
}
