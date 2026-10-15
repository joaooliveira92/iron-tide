import { Separator as BaseSeparator } from "@base-ui/react/separator";
import * as React from "react";

import { cn } from "../../lib/utils.js";

interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof BaseSeparator> {
  ref?: React.Ref<React.ComponentRef<typeof BaseSeparator>> | undefined;
}

const Separator = ({ className, orientation = "horizontal", ref, ...props }: SeparatorProps) => (
  <BaseSeparator
    ref={ref}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    {...props}
  />
);
Separator.displayName = "Separator";

export { Separator };
