import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

interface DialogOverlayProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Backdrop
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Backdrop>> | undefined;
}

const DialogOverlay = ({ className, ref, ...props }: DialogOverlayProps) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
      className,
    )}
    {...props}
  />
);
DialogOverlay.displayName = "DialogOverlay";

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Popup>> | undefined;
}

const DialogContent = ({ className, children, ref, ...props }: DialogContentProps) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 sm:rounded-lg",
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Popup>
  </DialogPortal>
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

interface DialogTitleProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Title>> | undefined;
}

const DialogTitle = ({ className, ref, ...props }: DialogTitleProps) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

interface DialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Description>> | undefined;
}

const DialogDescription = ({ className, ref, ...props }: DialogDescriptionProps) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
