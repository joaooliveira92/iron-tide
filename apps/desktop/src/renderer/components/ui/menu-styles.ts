export const MENU_POPUP =
  "z-50 min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";
export const MENU_ITEM =
  "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
export const MENU_INDICATOR_ITEM = `${MENU_ITEM} pl-8`;
export const MENU_INDICATOR = "absolute left-2 flex size-4 items-center justify-center";
export const MENU_LABEL = "px-2 py-1.5 text-xs font-medium text-muted-foreground";
export const MENU_SEPARATOR = "-mx-1 my-1 h-px bg-border";
export const MENU_SHORTCUT = "ml-auto text-xs tracking-widest text-muted-foreground";

export const FLOATING_LAYER = "z-[10000]";

export const SLATE_SURFACE =
  "relative z-50 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover/90 text-popover-foreground ring-1 ring-admiralty-accent/30 outline-hidden backdrop-blur-xl duration-100";

export const SLATE_POPUP = `${SLATE_SURFACE} slate-rise w-64 text-sm shadow-2xl`;

export const SLATE_TIP = `${SLATE_SURFACE} pointer-events-none w-auto max-w-64 px-2.5 py-1.5 text-xs leading-snug shadow-lg before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-admiralty-accent/70 before:to-transparent`;

export const SLATE_PANEL = `${SLATE_SURFACE} w-72 p-4 text-sm shadow-2xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-admiralty-accent/70 before:to-transparent`;
