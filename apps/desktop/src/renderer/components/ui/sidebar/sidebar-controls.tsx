import { PanelLeft } from "lucide-react";
import * as React from "react";

import { cn } from "../../../lib/utils.js";
import { Button } from "../button.js";
import { useSidebar } from "./context.js";

export interface SidebarTriggerProps extends React.ComponentProps<typeof Button> {
  ref?: React.Ref<React.ComponentRef<typeof Button>> | undefined;
}

export const SidebarTrigger = ({ className, onClick, ref, ...props }: SidebarTriggerProps) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};
SidebarTrigger.displayName = "SidebarTrigger";

export interface SidebarRailProps extends React.ComponentProps<"button"> {
  ref?: React.Ref<HTMLButtonElement> | undefined;
}

export const SidebarRail = ({ className, ref, ...props }: SidebarRailProps) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      ref={ref}
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
        "group-data-[side=left]:-right-4 group-data-[side=right]:left-0",
        className,
      )}
      {...props}
    />
  );
};
SidebarRail.displayName = "SidebarRail";
