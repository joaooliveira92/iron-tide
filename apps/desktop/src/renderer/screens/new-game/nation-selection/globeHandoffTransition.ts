import { useEffect, useState } from "react";

export const GLOBE_TRANSITION_MS = 650;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function useArmedAfterMount(active: boolean): boolean {
  const [armed, setArmed] = useState(() => active && prefersReducedMotion());

  useEffect(() => {
    if (!active) {
      setArmed(false);
      return;
    }
    if (prefersReducedMotion()) {
      setArmed(true);
      return;
    }

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setArmed(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [active]);

  return armed;
}
