import * as React from "react";

import { cn } from "../../../lib/utils.js";
import { Input } from "../input.js";
import { Separator } from "../separator.js";

export interface SidebarInsetProps extends React.ComponentProps<"main"> {
  ref?: React.Ref<HTMLElement> | undefined;
}

export const SidebarInset = ({ className, ref, ...props }: SidebarInsetProps) => (
  <main
    ref={ref}
    className={cn("relative flex min-h-svh w-full flex-1 flex-col bg-background", className)}
    {...props}
  />
);
SidebarInset.displayName = "SidebarInset";

export interface SidebarInputProps extends React.ComponentProps<typeof Input> {
  ref?: React.Ref<React.ComponentRef<typeof Input>> | undefined;
}

export const SidebarInput = ({ className, ref, ...props }: SidebarInputProps) => (
  <Input
    ref={ref}
    data-sidebar="input"
    className={cn("h-8 w-full bg-background shadow-none", className)}
    {...props}
  />
);
SidebarInput.displayName = "SidebarInput";

export interface SidebarDivProps extends React.ComponentProps<"div"> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

export const SidebarHeader = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="header"
    className={cn("flex flex-col gap-2 p-2", className)}
    {...props}
  />
);
SidebarHeader.displayName = "SidebarHeader";

export const SidebarFooter = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="footer"
    className={cn("flex flex-col gap-2 p-2", className)}
    {...props}
  />
);
SidebarFooter.displayName = "SidebarFooter";

export interface SidebarSeparatorProps extends React.ComponentProps<typeof Separator> {
  ref?: React.Ref<React.ComponentRef<typeof Separator>> | undefined;
}

export const SidebarSeparator = ({ className, ref, ...props }: SidebarSeparatorProps) => (
  <Separator
    ref={ref}
    data-sidebar="separator"
    className={cn("mx-2 w-auto bg-sidebar-border", className)}
    {...props}
  />
);
SidebarSeparator.displayName = "SidebarSeparator";

export const SidebarContent = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="content"
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
      className,
    )}
    {...props}
  />
);
SidebarContent.displayName = "SidebarContent";
