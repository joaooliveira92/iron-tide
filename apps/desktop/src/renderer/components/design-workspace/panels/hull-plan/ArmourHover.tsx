import type { ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../ui/hover-card.js";
import { AnatomyCardContent } from "./anatomy/AnatomyCardContent.js";
import type { AnatomyShip } from "./anatomy/ship-anatomy.js";

export function ArmourHover({
  anatomy,
  id,
  title,
  children,
}: {
  readonly anatomy: AnatomyShip | undefined;
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  if (anatomy === undefined) return <>{children}</>;
  return (
    <HoverCard>
      <HoverCardTrigger render={<g className="cursor-help" />}>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        collisionPadding={12}
        className="w-[26rem] max-w-[min(26rem,calc(100vw-2rem))]"
      >
        <AnatomyCardContent
          plate={anatomy}
          highlight={id}
          title={title}
          detail={anatomy.facts.get(id)}
          testId="armour-anatomy"
        />
      </HoverCardContent>
    </HoverCard>
  );
}
