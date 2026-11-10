import * as React from "react";

import { cn } from "../../../lib/utils.js";
import type { SidebarDivProps } from "./sidebar-layout.js";

export const SidebarGroup = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="group"
    className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
    {...props}
  />
);
SidebarGroup.displayName = "SidebarGroup";

export interface SidebarGroupLabelProps extends React.ComponentProps<"div"> {
  render?: React.ReactElement;
  ref?: React.Ref<HTMLDivElement> | undefined;
}

export const SidebarGroupLabel = ({
  className,
  render,
  children,
  ref,
  ...props
}: SidebarGroupLabelProps) => {
  if (render !== undefined) {
    return React.cloneElement(
      render,
      {
        ...props,
        ref,
        "data-sidebar": "group-label",
      } as Partial<unknown>,
      children,
    );
  }

  return (
    <div
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs text-sidebar-foreground/50 outline-none transition-[margin,opacity] duration-200 ease-linear",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupContent = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
);
SidebarGroupContent.displayName = "SidebarGroupContent";
