import * as React from "react";

import { cn } from "../../lib/utils.js";

/**
 * Joins adjacent buttons into one control: inner radii and duplicated borders
 * are collapsed so the group reads as a single segmented widget.
 */
interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const ButtonGroup = ({ className, ref, ...props }: ButtonGroupProps) => (
  <div
    ref={ref}
    role="group"
    className={cn(
      "flex items-center",
      "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none",
      "[&>*:not(:first-child)]:-ml-px",
      "[&>*:hover]:relative [&>*:focus-visible]:relative [&>*:focus-visible]:z-10",
      className,
    )}
    {...props}
  />
);
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
