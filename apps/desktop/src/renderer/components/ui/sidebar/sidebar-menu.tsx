import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../../lib/utils.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../hover-card.js";
import { Skeleton } from "../skeleton.js";
import { useSidebar } from "./context.js";

export interface SidebarMenuProps extends React.ComponentProps<"ul"> {
  ref?: React.Ref<HTMLUListElement> | undefined;
}

export const SidebarMenu = ({ className, ref, ...props }: SidebarMenuProps) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
);
SidebarMenu.displayName = "SidebarMenu";

export interface SidebarMenuItemProps extends React.ComponentProps<"li"> {
  ref?: React.Ref<HTMLLIElement> | undefined;
}

export const SidebarMenuItem = ({ className, ref, ...props }: SidebarMenuItemProps) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface SidebarMenuButtonProps extends React.ComponentProps<"button"> {
  render?: React.ReactElement;
  tooltip?: string;
  ref?: React.Ref<HTMLButtonElement> | undefined;
}

export const SidebarMenuButton = ({
  render,
  variant,
  size,
  tooltip,
  className,
  children,
  ref,
  ...props
}: SidebarMenuButtonProps & VariantProps<typeof sidebarMenuButtonVariants>) => {
  const { isMobile, state } = useSidebar();

  const buttonElement =
    render !== undefined ? (
      React.cloneElement(
        render,
        {
          ...props,
          ref,
          "data-sidebar": "menu-button",
          "data-size": size,
          className: cn(sidebarMenuButtonVariants({ variant, size }), className),
        } as Partial<unknown>,
        children,
      )
    ) : (
      <button
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );

  if (tooltip === undefined) return buttonElement;

  return (
    <HoverCard>
      <HoverCardTrigger render={buttonElement} />
      {state === "collapsed" && !isMobile && (
        <HoverCardContent side="right" variant="tip">
          {tooltip}
        </HoverCardContent>
      )}
    </HoverCard>
  );
};
SidebarMenuButton.displayName = "SidebarMenuButton";

export interface SidebarMenuSkeletonProps extends React.ComponentProps<"div"> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

export const SidebarMenuSkeleton = ({
  className,
  children,
  ref,
  ...props
}: SidebarMenuSkeletonProps) => (
  <div
    ref={ref}
    data-sidebar="menu-skeleton"
    className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
    {...props}
  >
    {children}
    <Skeleton className="h-4 max-w-(--skeleton-width) flex-1" data-sidebar="menu-skeleton-text" />
  </div>
);
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

export const SidebarMenuSkeletonIcon = () => (
  <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />
);
SidebarMenuSkeletonIcon.displayName = "SidebarMenuSkeletonIcon";
