"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, type ReactNode, useCallback } from "react";

import { cn } from "@/lib/utils";

import { useSelectContext } from "./context.js";
import { CHEVRON_TRANSITION, getTriggerMotion, INSTANT_TRANSITION } from "./motion.js";
import { assignRef } from "./options.js";

export interface SelectTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "children"
  | "value"
  | "defaultValue"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
> {
  children: ReactNode;
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger(
    { id, className, children, onClick, onKeyDown, ...buttonProps },
    forwardedRef,
  ) {
    const { state, actions, meta } = useSelectContext("SelectTrigger");
    const isTop = state.open ? state.placement === "top" : false;

    const triggerMotion = getTriggerMotion({
      open: state.open,
      isTop,
      reduceMotion: meta.reduceMotion,
    });

    const activeOption = meta.getOptionByValue(state.activeValue);

    const handleRef = useCallback(
      (node: HTMLButtonElement | null): void => {
        meta.triggerRef.current = node;
        assignRef(forwardedRef, node);
      },
      [meta.triggerRef, forwardedRef],
    );

    return (
      <motion.button
        {...buttonProps}
        ref={handleRef}
        id={id ?? meta.triggerId}
        type="button"
        role="combobox"
        disabled={state.disabled || buttonProps.disabled}
        aria-haspopup="listbox"
        aria-expanded={state.open}
        aria-controls={meta.listboxId}
        aria-activedescendant={state.open ? activeOption?.id : undefined}
        aria-required={state.required || undefined}
        aria-disabled={state.disabled || undefined}
        onClick={(event) => {
          onClick?.(event);

          if (event.defaultPrevented || state.disabled) {
            return;
          }

          actions.setOpen(!state.open);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);

          if (event.defaultPrevented) {
            return;
          }

          actions.handleTriggerKeyDown(event);
        }}
        initial={false}
        animate={triggerMotion.animate}
        transition={triggerMotion.transition}
        className={cn(
          "relative z-10 flex w-full items-center justify-between gap-2",
          "rounded-xl border border-border bg-background px-3 py-2",
          "text-sm text-foreground outline-none transition-colors",
          "hover:border-(--color-border-strong)",
          "focus-visible:ring-2 focus-visible:ring-foreground/20",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {children}

        <motion.span
          aria-hidden="true"
          animate={{
            rotate: state.open ? 180 : 0,
          }}
          transition={meta.reduceMotion ? INSTANT_TRANSITION : CHEVRON_TRANSITION}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>
    );
  },
);

SelectTrigger.displayName = "SelectTrigger";
