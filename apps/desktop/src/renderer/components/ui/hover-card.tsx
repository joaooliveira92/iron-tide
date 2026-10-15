import { PreviewCard as HoverCardPrimitive } from "@base-ui/react/preview-card";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { FLOATING_LAYER } from "./menu-styles.js";

const HoverCard = HoverCardPrimitive.Root;

/**
 * The trigger opens the card on hover or focus. ReUI's examples use a short
 * symmetric delay; we default to the same so hover cards feel immediate while
 * avoiding flicker when the pointer sweeps across a row of triggers. Callers
 * can override `delay`/`closeDelay` per trigger.
 */
const HoverCardTrigger = ({
  delay = 100,
  closeDelay = 100,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Trigger>) => (
  <HoverCardPrimitive.Trigger delay={delay} closeDelay={closeDelay} {...props} />
);
HoverCardTrigger.displayName = "HoverCardTrigger";

/** One card shared by several detached triggers: moving between them swaps the content instead of re-opening. */
const createHoverCardHandle = HoverCardPrimitive.createHandle;

/** A shared card handle: pass the same one to a `HoverCard` and its detached `HoverCardTrigger`s. */
type HoverCardHandle<Payload> = HoverCardPrimitive.Handle<Payload>;

interface HoverCardContentProps extends React.ComponentPropsWithoutRef<
  typeof HoverCardPrimitive.Popup
> {
  align?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Positioner>["align"];
  alignOffset?: number;
  side?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Positioner>["side"];
  sideOffset?: number;
  /** Space kept between the card and the viewport edges when it flips or shifts to fit. */
  collisionPadding?: React.ComponentPropsWithoutRef<
    typeof HoverCardPrimitive.Positioner
  >["collisionPadding"];
  /** Element to position against instead of the trigger (e.g. the drawing a set of triggers describes). */
  anchor?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Positioner>["anchor"];
  ref?: React.Ref<React.ComponentRef<typeof HoverCardPrimitive.Popup>> | undefined;
}

/**
 * ReUI/shadcn hover-card geometry: a `w-64` popover on the base tokens, anchored
 * with `origin-(--transform-origin)` and a side-aware slide-in, so every hover
 * popover in the app opens from the edge it is placed on.
 */
const HoverCardContent = ({
  className,
  align = "center",
  alignOffset = 4,
  side = "bottom",
  sideOffset = 4,
  collisionPadding,
  anchor,
  ref,
  ...props
}: HoverCardContentProps) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Positioner
      className={cn(FLOATING_LAYER, "isolate")}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      anchor={anchor}
    >
      <HoverCardPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 w-64 origin-(--transform-origin) rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Positioner>
  </HoverCardPrimitive.Portal>
);
HoverCardContent.displayName = "HoverCardContent";

export { createHoverCardHandle, HoverCard, HoverCardContent, HoverCardTrigger };
export type { HoverCardHandle };
