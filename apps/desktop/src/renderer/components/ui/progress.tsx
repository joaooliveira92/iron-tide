import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import * as React from "react";

import { cn } from "../../lib/utils.js";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  ref?: React.Ref<React.ComponentRef<typeof ProgressPrimitive.Root>> | undefined;
}

const Progress = ({ className, value, ref, ...props }: ProgressProps) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value ?? null}
    className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    {...props}
  >
    <ProgressPrimitive.Track className="h-full w-full">
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-out"
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
);
Progress.displayName = "Progress";

export { Progress };
