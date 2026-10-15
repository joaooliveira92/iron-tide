import { useEffect, useRef, useState } from "react";
import { PANEL_TRANSITION_MS } from "./constants.js";

export interface SlideVisibility {
  mounted: boolean;
  entered: boolean;
}

/**
 * Drives a slide panel's mount/enter/exit lifecycle from `isOpen`: `mounted`
 * keeps the panel in the tree through its exit transition, `entered` flips on
 * two frames after mounting so the CSS transition has a start state to leave.
 *
 * `animateOnMount` makes a panel that is open from its first render ease in
 * rather than appear fully entered.
 */
export function useSlideVisibility(isOpen: boolean, animateOnMount = false): SlideVisibility {
  const [mounted, setMounted] = useState(isOpen);
  const [entered, setEntered] = useState(isOpen && !animateOnMount);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameOneRef = useRef<number | null>(null);
  const frameTwoRef = useRef<number | null>(null);

  useEffect(() => {
    const clearPendingWork = (): void => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (frameOneRef.current !== null) {
        cancelAnimationFrame(frameOneRef.current);
        frameOneRef.current = null;
      }
      if (frameTwoRef.current !== null) {
        cancelAnimationFrame(frameTwoRef.current);
        frameTwoRef.current = null;
      }
    };

    clearPendingWork();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    if (isOpen) {
      setMounted(true);
      if (reducedMotion) {
        setEntered(true);
      } else {
        frameOneRef.current = requestAnimationFrame(() => {
          frameOneRef.current = null;
          frameTwoRef.current = requestAnimationFrame(() => {
            frameTwoRef.current = null;
            setEntered(true);
          });
        });
      }
    } else {
      setEntered(false);
      if (reducedMotion) {
        setMounted(false);
      } else {
        hideTimerRef.current = setTimeout(() => {
          hideTimerRef.current = null;
          setMounted(false);
        }, PANEL_TRANSITION_MS);
      }
    }

    return clearPendingWork;
  }, [isOpen]);

  return { mounted, entered };
}
