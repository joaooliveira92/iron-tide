import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-accent data-pressed:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8 text-xs",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ToggleProps
  extends
    React.ComponentPropsWithoutRef<typeof TogglePrimitive>,
    VariantProps<typeof toggleVariants> {
  ref?: React.Ref<React.ComponentRef<typeof TogglePrimitive>> | undefined;
}

const Toggle = ({ className, variant, size, ref, ...props }: ToggleProps) => (
  <TogglePrimitive
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
);
Toggle.displayName = "Toggle";

export { Toggle, toggleVariants };
