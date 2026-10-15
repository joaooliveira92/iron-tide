import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import * as React from "react";

import { cn } from "../../lib/utils.js";

interface RadioGroupProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive> {
  ref?: React.Ref<React.ComponentRef<typeof RadioGroupPrimitive>> | undefined;
}

const RadioGroup = ({ className, ref, ...props }: RadioGroupProps) => (
  <RadioGroupPrimitive ref={ref} className={cn("grid gap-4", className)} {...props} />
);
RadioGroup.displayName = "RadioGroup";

interface RadioGroupItemProps extends React.ComponentPropsWithoutRef<typeof RadioPrimitive.Root> {
  ref?: React.Ref<React.ComponentRef<typeof RadioPrimitive.Root>> | undefined;
}

const RadioGroupItem = ({ className, ref, ...props }: RadioGroupItemProps) => (
  <RadioPrimitive.Root
    ref={ref}
    className={cn(
      "cursor-pointer rounded-lg border bg-card text-card-foreground transition-colors",
      "hover:bg-accent",
      "data-checked:border-primary data-checked:ring-1 data-checked:ring-primary",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      className,
    )}
    {...props}
  />
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
