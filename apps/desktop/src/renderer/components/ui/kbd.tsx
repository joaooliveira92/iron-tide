import * as React from "react";

import { cn } from "../../lib/utils.js";

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  ref?: React.Ref<HTMLElement> | undefined;
}

const Kbd = ({ className, ref, ...props }: KbdProps) => (
  <kbd
    ref={ref}
    className={cn(
      "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[12px] font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
);
Kbd.displayName = "Kbd";

export { Kbd };
