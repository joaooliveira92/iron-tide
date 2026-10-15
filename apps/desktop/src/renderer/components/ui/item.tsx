import * as React from "react";

import { cn } from "../../lib/utils.js";

interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const Item = ({ className, ref, ...props }: ItemProps) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 rounded-md border p-2.5 text-xs", className)}
    {...props}
  />
);
Item.displayName = "Item";

const ItemContent = ({ className, ref, ...props }: ItemProps) => (
  <div ref={ref} className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)} {...props} />
);
ItemContent.displayName = "ItemContent";

const ItemTitle = ({ className, ref, ...props }: ItemProps) => (
  <div ref={ref} className={cn("truncate font-semibold text-foreground", className)} {...props} />
);
ItemTitle.displayName = "ItemTitle";

const ItemDescription = ({ className, ref, ...props }: ItemProps) => (
  <div
    ref={ref}
    className={cn("truncate text-[12px] text-muted-foreground", className)}
    {...props}
  />
);
ItemDescription.displayName = "ItemDescription";

const ItemActions = ({ className, ref, ...props }: ItemProps) => (
  <div ref={ref} className={cn("ml-auto flex shrink-0 items-center gap-2", className)} {...props} />
);
ItemActions.displayName = "ItemActions";

export { Item, ItemContent, ItemTitle, ItemDescription, ItemActions };
