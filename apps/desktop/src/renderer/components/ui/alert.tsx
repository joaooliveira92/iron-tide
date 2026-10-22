import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const alertVariants = cva(
  [
    "relative w-full rounded-lg border px-3 py-2.5 text-sm [&>svg:not([class*=size-])]:size-4",
    "has-[>svg]:grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_minmax(0,1fr)_auto] has-[>svg]:items-center has-[>svg]:gap-x-2.5 has-[>svg]:gap-y-0.5",
    "has-[>[data-slot=alert-title]+[data-slot=alert-description]]:items-start",
    "has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&>svg]:translate-y-0.5",
    "has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_[data-slot=alert-action]]:row-end-3",
  ],
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "border-destructive/30 bg-destructive/4 [&>svg]:text-destructive",
        info: "border-info/30 bg-info/4 [&>svg]:text-info",
        success: "border-success/30 bg-success/4 [&>svg]:text-success",
        warning: "border-warning/30 bg-warning/4 [&>svg]:text-warning",
        invert:
          "border-invert bg-invert text-invert-foreground [&_[data-slot=alert-description]]:text-invert-foreground/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const Alert = ({ className, variant, ref, ...props }: AlertProps) => (
  <div
    ref={ref}
    data-slot="alert"
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
);
Alert.displayName = "Alert";

interface AlertTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const AlertTitle = ({ className, ref, ...props }: AlertTitleProps) => (
  <div
    ref={ref}
    data-slot="alert-title"
    className={cn("col-start-2 min-h-4 font-medium tracking-tight", className)}
    {...props}
  />
);
AlertTitle.displayName = "AlertTitle";

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const AlertDescription = ({ className, ref, ...props }: AlertDescriptionProps) => (
  <div
    ref={ref}
    data-slot="alert-description"
    className={cn(
      "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
      className,
    )}
    {...props}
  />
);
AlertDescription.displayName = "AlertDescription";

interface AlertActionProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const AlertAction = ({ className, ref, ...props }: AlertActionProps) => (
  <div
    ref={ref}
    data-slot="alert-action"
    className={cn("col-start-3 row-start-1 flex gap-1.5 self-center justify-self-end", className)}
    {...props}
  />
);
AlertAction.displayName = "AlertAction";

export { Alert, AlertTitle, AlertDescription, AlertAction };
