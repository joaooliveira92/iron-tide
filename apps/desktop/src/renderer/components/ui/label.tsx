import * as React from "react";

import { cn } from "../../lib/utils.js";

interface LabelProps extends React.ComponentProps<"label"> {
  ref?: React.Ref<HTMLLabelElement> | undefined;
}

const Label = ({ className, ref, ...props }: LabelProps) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
);
Label.displayName = "Label";

export { Label };
