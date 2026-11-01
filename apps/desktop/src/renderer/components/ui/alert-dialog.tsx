import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { buttonVariants } from "./button.js";
import {
  MODAL_BODY_CLASS,
  MODAL_PADDING_CLASS,
  MODAL_SIZE_CLASS,
  MODAL_SURFACE_CLASS,
  type ModalSize,
} from "./modal-frame.js";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

interface AlertDialogOverlayProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Backdrop
> {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Backdrop>> | undefined;
}

const AlertDialogOverlay = ({ className, ref, ...props }: AlertDialogOverlayProps) => (
  <AlertDialogPrimitive.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
      className,
    )}
    {...props}
  />
);
AlertDialogOverlay.displayName = "AlertDialogOverlay";

interface AlertDialogContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Popup>,
  "className"
> {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Popup>> | undefined;
  readonly size?: ModalSize;
}

const AlertDialogContent = ({ size = "confirm", ref, ...props }: AlertDialogContentProps) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Popup
      ref={ref}
      aria-modal="true"
      className={cn(MODAL_SURFACE_CLASS, MODAL_SIZE_CLASS[size], MODAL_PADDING_CLASS)}
      {...props}
    />
  </AlertDialogPortal>
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex shrink-0 flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(MODAL_BODY_CLASS, className)} {...props} />
);
AlertDialogBody.displayName = "AlertDialogBody";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

interface AlertDialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Title
> {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Title>> | undefined;
}

const AlertDialogTitle = ({ className, ref, ...props }: AlertDialogTitleProps) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
);
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

interface AlertDialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Description
> {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Description>> | undefined;
}

const AlertDialogDescription = ({ className, ref, ...props }: AlertDialogDescriptionProps) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

interface AlertDialogActionProps extends React.ComponentPropsWithoutRef<"button"> {
  ref?: React.Ref<React.ComponentRef<"button">> | undefined;
}

const AlertDialogAction = ({ className, ref, ...props }: AlertDialogActionProps) => (
  <AlertDialogPrimitive.Close
    ref={ref}
    className={cn(buttonVariants({ variant: "destructive" }), className)}
    {...props}
  />
);
AlertDialogAction.displayName = "AlertDialogAction";

interface AlertDialogCancelProps extends React.ComponentPropsWithoutRef<"button"> {
  ref?: React.Ref<React.ComponentRef<"button">> | undefined;
}

const AlertDialogCancel = ({ className, ref, ...props }: AlertDialogCancelProps) => (
  <AlertDialogPrimitive.Close
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
);
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogBody,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
