import type { CSSProperties, ReactElement, ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/ui/hover-card.js";
import { PinnedHint, usePinnableCard } from "../pinnable-card.js";
import type { StripRow } from "../status-strip-state.js";
import { descriptionFor } from "./status-strip-notes.js";
import { TILE } from "./strip-styles.js";
import { CardHeader } from "./StripGlyph.js";

export type PinnableVariant = "button" | "pointer" | "pressable";

export interface PinnableCardProps {
  readonly trigger: ReactElement;
  readonly variant?: PinnableVariant;
  readonly triggerClassName?: string;
  readonly triggerProps?: Record<string, string | number | boolean | CSSProperties | undefined>;
  readonly children?: ReactNode;
  readonly card: ReactNode;
  readonly width?: string;
  readonly align?: "start" | "center" | "end";
  readonly delay?: number;
  readonly onActive?: (open: boolean) => void;
}

export function PinnableCard({
  trigger,
  variant = "button",
  triggerClassName,
  triggerProps,
  children,
  card,
  width = "w-72",
  align,
  delay = 150,
  onActive,
}: PinnableCardProps) {
  const pin = usePinnableCard(onActive);
  return (
    <HoverCard {...pin.rootProps}>
      <HoverCardTrigger
        delay={delay}
        render={trigger}
        className={triggerClassName}
        {...pin.triggerProps}
        {...(variant === "pressable" ? { onKeyDown: pin.onKeyDown, role: "button" } : {})}
        {...triggerProps}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align={align}
        sideOffset={10}
        collisionPadding={12}
        {...pin.contentProps}
        className={cn("p-0 text-xs leading-snug", width, pin.contentProps.className)}
      >
        {card}
        <PinnedHint pinned={pin.pinned} />
      </HoverCardContent>
    </HoverCard>
  );
}

export interface StripCardProps {
  readonly row: StripRow;
  readonly detail?: ReactNode;
  readonly width?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function StripCard({ row, detail, width, className, children }: StripCardProps) {
  const data = {
    "data-row": row.id,
    "data-tone": row.tone,
    "data-deferred": row.deferred,
  };
  const resolved = detail ?? (descriptionFor(row) === "" ? undefined : <StripNoteCard row={row} />);
  if (resolved === undefined) {
    return (
      <div {...data} className={cn(TILE, "cursor-default", className)}>
        {children}
      </div>
    );
  }
  return (
    <PinnableCard
      trigger={<div />}
      variant="pressable"
      card={resolved}
      {...(width === undefined ? {} : { width })}
      triggerClassName={cn(TILE, className)}
      triggerProps={{ ...data, tabIndex: 0, "aria-label": `${row.label}: ${row.value}` }}
    >
      {children}
    </PinnableCard>
  );
}

export function StripNoteCard({ row }: { readonly row: StripRow }) {
  return (
    <>
      <CardHeader title={row.label} tone={row.tone} />
      <p className="px-3 py-3">{descriptionFor(row)}</p>
    </>
  );
}
