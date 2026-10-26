import { PreviewCard as HoverCardPrimitive } from "@base-ui/react/preview-card";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { FLOATING_LAYER, SLATE_POPUP, SLATE_TIP } from "./menu-styles.js";
import { Registration } from "./slate.js";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = ({
  delay = 100,
  closeDelay = 100,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Trigger>) => (
  <HoverCardPrimitive.Trigger delay={delay} closeDelay={closeDelay} {...props} />
);
HoverCardTrigger.displayName = "HoverCardTrigger";

const createHoverCardHandle = HoverCardPrimitive.createHandle;

type HoverCardHandle<Payload> = HoverCardPrimitive.Handle<Payload>;

interface HoverCardContentProps extends React.ComponentPropsWithoutRef<
  typeof HoverCardPrimitive.Popup
> {
  align?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Positioner>["align"];
  alignOffset?: number;
  side?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Positioner>["side"];
  sideOffset?: number;
  collisionPadding?: React.ComponentPropsWithoutRef<
    typeof HoverCardPrimitive.Positioner
  >["collisionPadding"];
  anchor?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Positioner>["anchor"];
  variant?: "card" | "tip";
  ref?: React.Ref<React.ComponentRef<typeof HoverCardPrimitive.Popup>> | undefined;
}

const HoverCardContent = ({
  className,
  align = "center",
  alignOffset = 4,
  side = "bottom",
  sideOffset = 4,
  collisionPadding,
  anchor,
  variant = "card",
  ref,
  children,
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
          variant === "tip" ? SLATE_TIP : SLATE_POPUP,
          "data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {variant === "card" && <Registration />}
      </HoverCardPrimitive.Popup>
    </HoverCardPrimitive.Positioner>
  </HoverCardPrimitive.Portal>
);
HoverCardContent.displayName = "HoverCardContent";

export { createHoverCardHandle, HoverCard, HoverCardContent, HoverCardTrigger };
export type { HoverCardHandle };
