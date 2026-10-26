import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card.js";
import { SlateFoot, SlateHeader } from "./slate.js";

export interface DossierProps {
  readonly trigger: ReactNode;
  readonly triggerProps: {
    readonly className: string;
    readonly "aria-label": string;
    readonly onClick?: () => void;
    readonly disabled?: boolean;
  };
  readonly icon: ReactNode;
  readonly title: string;
  readonly aside?: ReactNode;
  readonly foot?: ReactNode;
  readonly tone?: "normal" | "alert";
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly children: ReactNode;
}

export function Dossier({
  trigger,
  triggerProps,
  icon,
  title,
  aside,
  foot,
  tone = "normal",
  side = "left",
  children,
}: DossierProps) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={80}
        closeDelay={60}
        render={<button type="button" />}
        {...triggerProps}
      >
        {trigger}
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align="center"
        sideOffset={12}
        collisionPadding={12}
        className="w-80 p-0"
      >
        <SlateHeader icon={icon} title={title} tone={tone} aside={aside} />
        <div className="space-y-3 px-3 py-3">{children}</div>
        {foot !== undefined && <SlateFoot>{foot}</SlateFoot>}
      </HoverCardContent>
    </HoverCard>
  );
}

const LEVEL_FILL: Readonly<Record<number, string>> = {
  1: "bg-muted-foreground/60",
  2: "bg-admiralty-signal",
  3: "bg-warning",
  4: "bg-destructive",
};

export function SeverityRuler({
  level,
  className,
}: {
  readonly level: number;
  readonly className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("flex gap-1", className)}>
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 flex-1 rounded-full bg-muted transition-colors",
            step <= level && LEVEL_FILL[level],
          )}
        />
      ))}
    </span>
  );
}
