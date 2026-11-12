"use client";

import { motion } from "motion/react";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { FLOATING_LAYER } from "../menu-styles.js";
import { useSelectContext } from "./context.js";
import { getContentMotion, LIST_VARIANTS } from "./motion.js";
import { useFloatingPosition } from "./use-floating-position.js";

const DEFAULT_SIDE_OFFSET = 8;
const DEFAULT_VIEWPORT_PADDING = 8;
const DEFAULT_MAX_HEIGHT = 320;

export interface SelectContentProps {
  className?: string;
  viewportClassName?: string;
  children: ReactNode;

  sideOffset?: number;
  viewportPadding?: number;
  maxHeight?: number;
}

export function SelectContent({
  className,
  viewportClassName,
  children,
  sideOffset = DEFAULT_SIDE_OFFSET,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  maxHeight = DEFAULT_MAX_HEIGHT,
}: SelectContentProps) {
  const { state, actions, meta } = useSelectContext("SelectContent");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { viewportRef, position, contentHeight } = useFloatingPosition({
    triggerRef: meta.triggerRef,
    setPlacement: actions.setPlacement,
    mounted,
    open: state.open,
    content: children,
    sideOffset,
    viewportPadding,
    maxHeight,
  });

  useLayoutEffect(() => {
    if (!state.open || state.activeValue === null) {
      return;
    }

    const option = meta.getOptionByValue(state.activeValue);

    option?.ref.current?.scrollIntoView({
      block: "nearest",
    });
  }, [state.activeValue, meta.getOptionByValue, state.open]);

  if (!mounted) {
    return null;
  }

  const placement = state.placement;
  const isTop = placement === "top";

  const contentMotion = getContentMotion({
    open: state.open,
    isTop,
    reduceMotion: meta.reduceMotion,
    sideOffset,
    targetHeight: state.open && position ? contentHeight : 0,
  });

  return createPortal(
    <motion.div
      ref={meta.floatingRef}
      id={meta.listboxId}
      role="listbox"
      aria-hidden={!state.open}
      data-placement={placement}
      inert={!state.open}
      initial={false}
      animate={contentMotion.animate}
      transition={contentMotion.transition}
      style={{
        position: "fixed",
        left: position?.left ?? 0,
        width: position?.width ?? 0,

        ...(isTop
          ? {
              bottom: position ? window.innerHeight - position.anchorTop : 0,
            }
          : {
              top: position?.anchorBottom ?? 0,
            }),

        transformOrigin: isTop ? "bottom" : "top",
        overflow: "hidden",
        pointerEvents: state.open ? "auto" : "none",
        visibility: position ? "visible" : "hidden",
      }}
      className={cn(
        "rounded-xl border border-border bg-background shadow-lg",
        FLOATING_LAYER,
        className,
      )}
    >
      <motion.div
        ref={viewportRef}
        {...(meta.reduceMotion ? {} : { variants: LIST_VARIANTS })}
        initial={false}
        animate={state.open ? "show" : "hidden"}
        style={{
          maxHeight: position?.availableHeight ?? DEFAULT_MAX_HEIGHT,
        }}
        className={cn("overflow-y-auto overscroll-contain p-1", viewportClassName)}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
