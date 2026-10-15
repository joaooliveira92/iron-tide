import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { toggleVariants } from "./toggle.js";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

interface ToggleGroupProps
  extends
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive>,
    VariantProps<typeof toggleVariants> {
  ref?: React.Ref<React.ComponentRef<typeof ToggleGroupPrimitive>> | undefined;
}

const ToggleGroup = ({ className, variant, size, children, ref, ...props }: ToggleGroupProps) => (
  <ToggleGroupPrimitive
    ref={ref}
    className={cn("flex items-center justify-center gap-1 rounded-md bg-muted p-1", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive>
);
ToggleGroup.displayName = "ToggleGroup";

interface ToggleGroupItemProps
  extends
    React.ComponentPropsWithoutRef<typeof TogglePrimitive>,
    VariantProps<typeof toggleVariants> {
  ref?: React.Ref<React.ComponentRef<typeof TogglePrimitive>> | undefined;
}

const ToggleGroupItem = ({
  className,
  children,
  variant,
  size,
  ref,
  ...props
}: ToggleGroupItemProps) => {
  const context = React.use(ToggleGroupContext);

  return (
    <TogglePrimitive
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "data-pressed:bg-background",
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
};
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
