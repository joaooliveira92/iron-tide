import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { FLOATING_LAYER } from "./menu-styles.js";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverClose = PopoverPrimitive.Close;
const PopoverAnchor = PopoverPrimitive.Trigger;

interface PopoverContentProps extends React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Popup
> {
  align?: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Positioner>["align"];
  side?: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Positioner>["side"];
  sideOffset?: number;
  ref?: React.Ref<React.ComponentRef<typeof PopoverPrimitive.Popup>> | undefined;
}

const PopoverContent = ({
  className,
  align = "center",
  side,
  sideOffset = 4,
  ref,
  ...props
}: PopoverContentProps) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      className={FLOATING_LAYER}
      align={align}
      side={side}
      sideOffset={sideOffset}
    >
      <PopoverPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          "animate-in fade-in-0 zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
