import * as React from "react";

import { cn } from "../../lib/utils.js";

interface FieldGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const FieldGroup = ({ className, ref, ...props }: FieldGroupProps) => (
  <div ref={ref} className={cn("space-y-4", className)} {...props} />
);
FieldGroup.displayName = "FieldGroup";

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal";
  ref?: React.Ref<HTMLDivElement> | undefined;
}

const Field = ({ className, orientation = "vertical", ref, ...props }: FieldProps) => (
  <div
    ref={ref}
    className={cn(
      orientation === "horizontal" ? "flex items-center gap-4" : "space-y-1.5",
      className,
    )}
    {...props}
  />
);
Field.displayName = "Field";

interface FieldLabelProps extends React.ComponentProps<"label"> {
  ref?: React.Ref<HTMLLabelElement> | undefined;
}

const FieldLabel = ({ className, ref, ...props }: FieldLabelProps) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
);
FieldLabel.displayName = "FieldLabel";

interface FieldDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement> | undefined;
}

const FieldDescription = ({ className, ref, ...props }: FieldDescriptionProps) => (
  <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
);
FieldDescription.displayName = "FieldDescription";

export { FieldGroup, Field, FieldLabel, FieldDescription };
