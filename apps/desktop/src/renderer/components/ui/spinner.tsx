import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";

function Spinner({ className, ...props }: React.ComponentPropsWithoutRef<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("h-4 w-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
