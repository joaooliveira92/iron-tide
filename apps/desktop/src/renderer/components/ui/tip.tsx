import { cloneElement, useState, type ReactElement, type ReactNode } from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card.js";

export interface TipProps {
  readonly label: ReactNode;
  readonly children: ReactElement<{ "aria-description"?: string }>;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  readonly disabled?: boolean;
}

export function Tip({
  label,
  children,
  side = "top",
  align = "center",
  disabled = false,
}: TipProps) {
  const [open, setOpen] = useState(false);
  if (disabled) return children;
  const trigger =
    typeof label === "string" ? cloneElement(children, { "aria-description": label }) : children;
  const dismiss = () => setOpen(false);
  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={350}
        closeDelay={0}
        render={trigger}
        onPointerDown={dismiss}
        onClick={dismiss}
      />
      <HoverCardContent variant="tip" side={side} align={align} sideOffset={6} collisionPadding={8}>
        {label}
      </HoverCardContent>
    </HoverCard>
  );
}
