import * as React from "react";

import { cn } from "../../lib/utils.js";

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const Empty = ({ className, ref, ...props }: EmptyProps) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center",
      className,
    )}
    {...props}
  />
);
Empty.displayName = "Empty";

const EmptyIcon = ({ className, ref, ...props }: EmptyProps) => (
  <div
    ref={ref}
    className={cn(
      "flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-4 [&_svg]:w-4",
      className,
    )}
    {...props}
  />
);
EmptyIcon.displayName = "EmptyIcon";

interface EmptyTitleProps extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement> | undefined;
}

const EmptyTitle = ({ className, ref, ...props }: EmptyTitleProps) => (
  <p ref={ref} className={cn("text-sm font-medium text-foreground", className)} {...props} />
);
EmptyTitle.displayName = "EmptyTitle";

const EmptyDescription = ({ className, ref, ...props }: EmptyTitleProps) => (
  <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
);
EmptyDescription.displayName = "EmptyDescription";

export { Empty, EmptyIcon, EmptyTitle, EmptyDescription };
