import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import * as React from "react";

import { Button } from "./button.js";
import { Input } from "./input.js";
import { Separator } from "./separator.js";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet.js";
import { Skeleton } from "./skeleton.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card.js";
import { useIsMobile } from "../../lib/use-mobile.js";
import { cn } from "../../lib/utils.js";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = React.use(SidebarContext);
  if (context === null) throw new Error("useSidebar must be used within a SidebarProvider.");
  return context;
}

interface SidebarProviderProps extends React.ComponentProps<"div"> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ref,
  ...props
}: SidebarProviderProps) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (setOpenProp !== undefined) setOpenProp(value);
      else setInternalOpen(value);
    },
    [setOpenProp],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(!openMobile);
    else setOpen(!open);
  }, [isMobile, open, openMobile, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        ref={ref}
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};
SidebarProvider.displayName = "SidebarProvider";

interface SidebarProps extends React.ComponentProps<"div"> {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const Sidebar = ({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ref,
  ...props
}: SidebarProps) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          side={side}
          className="w-(--sidebar-width) bg-sidebar/70 p-0 text-sidebar-foreground backdrop-blur-md [&>button]:hidden supports-[backdrop-filter]:bg-sidebar/60"
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={ref}
      className="group peer relative hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
    >
      <div
        className={cn(
          "relative h-full w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 z-10 hidden h-full w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className="flex h-full w-full flex-col bg-sidebar/70 backdrop-blur-md group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border supports-[backdrop-filter]:bg-sidebar/60"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
Sidebar.displayName = "Sidebar";

interface SidebarTriggerProps extends React.ComponentProps<typeof Button> {
  ref?: React.Ref<React.ComponentRef<typeof Button>> | undefined;
}

const SidebarTrigger = ({ className, onClick, ref, ...props }: SidebarTriggerProps) => {
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

interface SidebarRailProps extends React.ComponentProps<"button"> {
  ref?: React.Ref<HTMLButtonElement> | undefined;
}

const SidebarRail = ({ className, ref, ...props }: SidebarRailProps) => {
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

interface SidebarInsetProps extends React.ComponentProps<"main"> {
  ref?: React.Ref<HTMLElement> | undefined;
}

const SidebarInset = ({ className, ref, ...props }: SidebarInsetProps) => (
  <main
    ref={ref}
    className={cn("relative flex min-h-svh w-full flex-1 flex-col bg-background", className)}
    {...props}
  />
);
SidebarInset.displayName = "SidebarInset";

interface SidebarInputProps extends React.ComponentProps<typeof Input> {
  ref?: React.Ref<React.ComponentRef<typeof Input>> | undefined;
}

const SidebarInput = ({ className, ref, ...props }: SidebarInputProps) => (
  <Input
    ref={ref}
    data-sidebar="input"
    className={cn("h-8 w-full bg-background shadow-none", className)}
    {...props}
  />
);
SidebarInput.displayName = "SidebarInput";

interface SidebarDivProps extends React.ComponentProps<"div"> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const SidebarHeader = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="header"
    className={cn("flex flex-col gap-2 p-2", className)}
    {...props}
  />
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="footer"
    className={cn("flex flex-col gap-2 p-2", className)}
    {...props}
  />
);
SidebarFooter.displayName = "SidebarFooter";

interface SidebarSeparatorProps extends React.ComponentProps<typeof Separator> {
  ref?: React.Ref<React.ComponentRef<typeof Separator>> | undefined;
}

const SidebarSeparator = ({ className, ref, ...props }: SidebarSeparatorProps) => (
  <Separator
    ref={ref}
    data-sidebar="separator"
    className={cn("mx-2 w-auto bg-sidebar-border", className)}
    {...props}
  />
);
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarContent = ({ className, ref, ...props }: SidebarDivProps) => (
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

const SidebarGroup = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="group"
    className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
    {...props}
  />
);
SidebarGroup.displayName = "SidebarGroup";

interface SidebarGroupLabelProps extends React.ComponentProps<"div"> {
  asChild?: boolean;
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const SidebarGroupLabel = ({
  className,
  asChild = false,
  children,
  ref,
  ...props
}: SidebarGroupLabelProps) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ref,
      "data-sidebar": "group-label",
    } as Partial<unknown>);
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

const SidebarGroupContent = ({ className, ref, ...props }: SidebarDivProps) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
);
SidebarGroupContent.displayName = "SidebarGroupContent";

interface SidebarMenuProps extends React.ComponentProps<"ul"> {
  ref?: React.Ref<HTMLUListElement> | undefined;
}

const SidebarMenu = ({ className, ref, ...props }: SidebarMenuProps) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
);
SidebarMenu.displayName = "SidebarMenu";

interface SidebarMenuItemProps extends React.ComponentProps<"li"> {
  ref?: React.Ref<HTMLLIElement> | undefined;
}

const SidebarMenuItem = ({ className, ref, ...props }: SidebarMenuItemProps) => (
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

interface SidebarMenuButtonProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
  ref?: React.Ref<HTMLButtonElement> | undefined;
}

const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
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
    asChild && React.isValidElement(children) ? (
      React.cloneElement(children, {
        ...props,
        ref,
        "data-sidebar": "menu-button",
        "data-size": size,
        "data-active": isActive,
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      } as Partial<unknown>)
    ) : (
      <button
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
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
        <HoverCardContent side="right" className="w-auto max-w-64 px-3 py-1.5 text-xs">
          {tooltip}
        </HoverCardContent>
      )}
    </HoverCard>
  );
};
SidebarMenuButton.displayName = "SidebarMenuButton";

interface SidebarMenuSkeletonProps extends React.ComponentProps<"div"> {
  showIcon?: boolean;
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const SidebarMenuSkeleton = ({
  className,
  showIcon = false,
  ref,
  ...props
}: SidebarMenuSkeletonProps) => (
  <div
    ref={ref}
    data-sidebar="menu-skeleton"
    className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
    {...props}
  >
    {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
    <Skeleton className="h-4 max-w-(--skeleton-width) flex-1" data-sidebar="menu-skeleton-text" />
  </div>
);
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
};
