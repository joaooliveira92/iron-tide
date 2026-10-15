import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import * as React from "react";

import { cn } from "../../lib/utils.js";

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  ref?: React.Ref<React.ComponentRef<typeof ScrollAreaPrimitive.Root>> | undefined;
}

const ScrollArea = ({ className, children, ref, ...props }: ScrollAreaProps) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);
ScrollArea.displayName = "ScrollArea";

interface ScrollBarProps extends React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Scrollbar
> {
  ref?: React.Ref<React.ComponentRef<typeof ScrollAreaPrimitive.Scrollbar>> | undefined;
}

const ScrollBar = ({ className, orientation = "vertical", ref, ...props }: ScrollBarProps) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-px",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.Scrollbar>
);
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
