import { Dialog as CommandDialogPrimitive } from "@base-ui/react/dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";

interface CommandProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive>> | undefined;
}

const Command = ({ className, ref, ...props }: CommandProps) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
);
Command.displayName = CommandPrimitive.displayName;

export interface CommandDialogProps extends Omit<
  React.ComponentPropsWithoutRef<typeof CommandDialogPrimitive.Root>,
  "children"
> {
  readonly title?: string;
  readonly description?: string;
  readonly children?: React.ReactNode;
}

/** A command palette shown in a modal. Open state is controlled by the caller. */
const CommandDialog = ({
  title = "Command menu",
  description = "Search for a screen or action…",
  children,
  ...props
}: CommandDialogProps) => (
  <CommandDialogPrimitive.Root {...props}>
    <CommandDialogPrimitive.Portal>
      <CommandDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0" />
      <CommandDialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-popover shadow-lg",
          "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95",
        )}
      >
        <CommandDialogPrimitive.Title className="sr-only">{title}</CommandDialogPrimitive.Title>
        <CommandDialogPrimitive.Description className="sr-only">
          {description}
        </CommandDialogPrimitive.Description>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5">
          {children}
        </Command>
      </CommandDialogPrimitive.Popup>
    </CommandDialogPrimitive.Portal>
  </CommandDialogPrimitive.Root>
);

interface CommandInputProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive.Input>> | undefined;
}

const CommandInput = ({ className, ref, ...props }: CommandInputProps) => (
  <div className="flex items-center gap-2 border-b px-3">
    <Search className="size-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
);
CommandInput.displayName = CommandPrimitive.Input.displayName;

interface CommandListProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive.List>> | undefined;
}

const CommandList = ({ className, ref, ...props }: CommandListProps) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-80 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
);
CommandList.displayName = CommandPrimitive.List.displayName;

interface CommandEmptyProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive.Empty>> | undefined;
}

const CommandEmpty = ({ ref, ...props }: CommandEmptyProps) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-muted-foreground"
    {...props}
  />
);
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

interface CommandGroupProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive.Group>> | undefined;
}

const CommandGroup = ({ className, ref, ...props }: CommandGroupProps) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn("overflow-hidden p-1 text-foreground", className)}
    {...props}
  />
);
CommandGroup.displayName = CommandPrimitive.Group.displayName;

interface CommandSeparatorProps extends React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Separator
> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive.Separator>> | undefined;
}

const CommandSeparator = ({ className, ref, ...props }: CommandSeparatorProps) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
);
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

interface CommandItemProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {
  ref?: React.Ref<React.ComponentRef<typeof CommandPrimitive.Item>> | undefined;
}

const CommandItem = ({ className, ref, ...props }: CommandItemProps) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
);
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
    {...props}
  />
);
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
