import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center justify-center text-muted-foreground",
  {
    variants: {
      variant: {
        default: "h-9 rounded-lg bg-muted p-1",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface TabsListProps
  extends
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.List>> | undefined;
}

const TabsList = ({ className, variant, ref, ...props }: TabsListProps) => (
  <TabsPrimitive.List
    ref={ref}
    data-variant={variant ?? "default"}
    className={cn(tabsListVariants({ variant }), className)}
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
      "group-data-[variant=line]/tabs-list:relative group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
      "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:bg-foreground group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:after:transition-opacity group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
      "group-data-[variant=line]/tabs-list:data-[orientation=horizontal]:after:inset-x-2 group-data-[variant=line]/tabs-list:data-[orientation=horizontal]:after:-bottom-1 group-data-[variant=line]/tabs-list:data-[orientation=horizontal]:after:h-0.5",
      "group-data-[variant=line]/tabs-list:data-[orientation=vertical]:after:inset-y-1 group-data-[variant=line]/tabs-list:data-[orientation=vertical]:after:-left-1 group-data-[variant=line]/tabs-list:data-[orientation=vertical]:after:w-0.5",
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

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
