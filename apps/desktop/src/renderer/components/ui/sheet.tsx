import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

interface SheetOverlayProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Backdrop> {
  ref?: React.Ref<React.ComponentRef<typeof SheetPrimitive.Backdrop>> | undefined;
}

const SheetOverlay = ({ className, ref, ...props }: SheetOverlayProps) => (
  <SheetPrimitive.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
      className,
    )}
    {...props}
  />
);
SheetOverlay.displayName = "SheetOverlay";

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 transition ease-in-out data-open:animate-in data-closed:animate-out data-closed:duration-300 data-open:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-closed:slide-out-to-top data-open:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-closed:slide-out-to-bottom data-open:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-closed:slide-out-to-left data-open:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-closed:slide-out-to-right data-open:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Popup>,
    VariantProps<typeof sheetVariants> {
  ref?: React.Ref<React.ComponentRef<typeof SheetPrimitive.Popup>> | undefined;
}

const SheetContent = ({
  side = "right",
  className,
  children,
  ref,
  ...props
}: SheetContentProps) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Popup ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Popup>
  </SheetPortal>
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

interface SheetTitleProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title> {
  ref?: React.Ref<React.ComponentRef<typeof SheetPrimitive.Title>> | undefined;
}

const SheetTitle = ({ className, ref, ...props }: SheetTitleProps) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
);
SheetTitle.displayName = SheetPrimitive.Title.displayName;

interface SheetDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof SheetPrimitive.Description
> {
  ref?: React.Ref<React.ComponentRef<typeof SheetPrimitive.Description>> | undefined;
}

const SheetDescription = ({ className, ref, ...props }: SheetDescriptionProps) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
