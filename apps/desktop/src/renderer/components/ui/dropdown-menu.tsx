import { Menu as Primitive } from "@base-ui/react/menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import {
  FLOATING_LAYER,
  MENU_INDICATOR,
  MENU_INDICATOR_ITEM,
  MENU_ITEM,
  MENU_LABEL,
  MENU_POPUP,
  MENU_SEPARATOR,
  MENU_SHORTCUT,
} from "./menu-styles.js";

const DropdownMenu = Primitive.Root;
const DropdownMenuTrigger = Primitive.Trigger;
const DropdownMenuGroup = Primitive.Group;
const DropdownMenuRadioGroup = Primitive.RadioGroup;
const DropdownMenuSub = Primitive.SubmenuRoot;

type PopupProps = React.ComponentPropsWithoutRef<typeof Primitive.Popup> & {
  align?: React.ComponentPropsWithoutRef<typeof Primitive.Positioner>["align"];
  side?: React.ComponentPropsWithoutRef<typeof Primitive.Positioner>["side"];
  sideOffset?: number;
};

const DropdownMenuContent = ({ className, align, side, sideOffset = 4, ...props }: PopupProps) => (
  <Primitive.Portal>
    <Primitive.Positioner
      className={FLOATING_LAYER}
      align={align}
      side={side}
      sideOffset={sideOffset}
    >
      <Primitive.Popup className={cn(MENU_POPUP, className)} {...props} />
    </Primitive.Positioner>
  </Primitive.Portal>
);

const DropdownMenuSubContent = ({ className, ...props }: PopupProps) => (
  <Primitive.Portal>
    <Primitive.Positioner className={FLOATING_LAYER} sideOffset={2}>
      <Primitive.Popup className={cn(MENU_POPUP, className)} {...props} />
    </Primitive.Positioner>
  </Primitive.Portal>
);

const DropdownMenuItem = ({
  className,
  inset,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.Item> & {
  inset?: boolean;
  destructive?: boolean;
}) => (
  <Primitive.Item
    className={cn(
      MENU_ITEM,
      inset && "pl-8",
      destructive &&
        "text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive",
      className,
    )}
    {...props}
  />
);

const DropdownMenuCheckboxItem = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.CheckboxItem>) => (
  <Primitive.CheckboxItem className={cn(MENU_INDICATOR_ITEM, className)} {...props}>
    <span className={MENU_INDICATOR}>
      <Primitive.CheckboxItemIndicator>
        <Check className="size-4" />
      </Primitive.CheckboxItemIndicator>
    </span>
    {children}
  </Primitive.CheckboxItem>
);

const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.RadioItem>) => (
  <Primitive.RadioItem className={cn(MENU_INDICATOR_ITEM, className)} {...props}>
    <span className={MENU_INDICATOR}>
      <Primitive.RadioItemIndicator>
        <Circle className="size-2 fill-current" />
      </Primitive.RadioItemIndicator>
    </span>
    {children}
  </Primitive.RadioItem>
);

const DropdownMenuSubTrigger = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.SubmenuTrigger>) => (
  <Primitive.SubmenuTrigger className={cn(MENU_ITEM, className)} {...props}>
    {children}
    <ChevronRight className="ml-auto" />
  </Primitive.SubmenuTrigger>
);

const DropdownMenuLabel = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Primitive.GroupLabel>) => (
  <Primitive.GroupLabel className={cn(MENU_LABEL, className)} {...props} />
);

const DropdownMenuSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    role="separator"
    aria-orientation="horizontal"
    className={cn(MENU_SEPARATOR, className)}
    {...props}
  />
);

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn(MENU_SHORTCUT, className)} {...props} />
);

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
