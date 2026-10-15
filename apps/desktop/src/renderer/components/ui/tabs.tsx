import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const Tabs = TabsPrimitive.Root;

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.List>> | undefined;
}

const TabsList = ({ className, ref, ...props }: TabsListProps) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
);
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tab> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.Tab>> | undefined;
}

const TabsTrigger = ({ className, ref, ...props }: TabsTriggerProps) => (
  <TabsPrimitive.Tab
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
      "disabled:pointer-events-none disabled:opacity-50",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "data-active:bg-background data-active:text-foreground",
      className,
    )}
    {...props}
  />
);
TabsTrigger.displayName = TabsPrimitive.Tab.displayName;

interface TabsContentProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Panel> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.Panel>> | undefined;
}

const TabsContent = ({ className, ref, ...props }: TabsContentProps) => (
  <TabsPrimitive.Panel
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      className,
    )}
    {...props}
  />
);
TabsContent.displayName = TabsPrimitive.Panel.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
