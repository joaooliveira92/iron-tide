import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from "react";

import type { FloatingPosition, Placement, SelectMeta } from "./types.js";

interface FloatingPositionInput {
  triggerRef: SelectMeta["triggerRef"];
  setPlacement: (placement: Placement) => void;
  mounted: boolean;
  open: boolean;
  content: unknown;
  sideOffset: number;
  viewportPadding: number;
  maxHeight: number;
}

export interface FloatingPositionResult {
  viewportRef: RefObject<HTMLDivElement | null>;
  position: FloatingPosition | null;
  contentHeight: number;
}

export function useFloatingPosition({
  triggerRef,
  setPlacement,
  mounted,
  open,
  content,
  sideOffset,
  viewportPadding,
  maxHeight,
}: FloatingPositionInput): FloatingPositionResult {
  const viewportRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [contentHeight, setContentHeight] = useState(0);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const updatePosition = useCallback((): void => {
    const trigger = triggerRef.current;
    const viewport = viewportRef.current;

    if (!trigger || !viewport) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();

    const measuredHeight = Math.max(viewport.scrollHeight, viewport.offsetHeight);

    const availableBelow = Math.max(
      0,
      window.innerHeight - triggerRect.bottom - sideOffset - viewportPadding,
    );

    const availableAbove = Math.max(0, triggerRect.top - sideOffset - viewportPadding);

    const preferredHeight = Math.min(measuredHeight, maxHeight);

    const placement: Placement =
      availableBelow >= preferredHeight || availableBelow >= availableAbove ? "bottom" : "top";

    setPlacement(placement);

    const availableHeight = Math.max(
      0,
      Math.min(maxHeight, placement === "bottom" ? availableBelow : availableAbove),
    );

    setContentHeight(Math.min(measuredHeight, availableHeight));

    setPosition((previous) => {
      const next: FloatingPosition = {
        left: Math.max(
          viewportPadding,
          Math.min(triggerRect.left, window.innerWidth - viewportPadding - triggerRect.width),
        ),
        width: Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2),
        anchorTop: triggerRect.top,
        anchorBottom: triggerRect.bottom,
        availableHeight,
      };

      if (
        previous &&
        previous.left === next.left &&
        previous.width === next.width &&
        previous.anchorTop === next.anchorTop &&
        previous.anchorBottom === next.anchorBottom &&
        previous.availableHeight === next.availableHeight
      ) {
        return previous;
      }

      return next;
    });
  }, [setPlacement, triggerRef, maxHeight, sideOffset, viewportPadding]);

  const schedulePositionUpdate = useCallback((): void => {
    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    updatePosition();
  }, [content, open, mounted, updatePosition]);

  useLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    const trigger = triggerRef.current;
    const viewport = viewportRef.current;

    if (!trigger || !viewport) {
      return;
    }

    const resizeObserver = new ResizeObserver(schedulePositionUpdate);

    resizeObserver.observe(trigger);
    resizeObserver.observe(viewport);

    window.addEventListener("resize", schedulePositionUpdate);

    window.addEventListener("scroll", schedulePositionUpdate, true);

    window.visualViewport?.addEventListener("resize", schedulePositionUpdate);

    window.visualViewport?.addEventListener("scroll", schedulePositionUpdate);

    return () => {
      resizeObserver.disconnect();

      window.removeEventListener("resize", schedulePositionUpdate);

      window.removeEventListener("scroll", schedulePositionUpdate, true);

      window.visualViewport?.removeEventListener("resize", schedulePositionUpdate);

      window.visualViewport?.removeEventListener("scroll", schedulePositionUpdate);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);

        animationFrameRef.current = null;
      }
    };
  }, [triggerRef, mounted, schedulePositionUpdate]);

  return { viewportRef, position, contentHeight };
}
