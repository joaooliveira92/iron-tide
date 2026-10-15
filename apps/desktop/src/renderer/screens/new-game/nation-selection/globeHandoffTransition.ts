import { useEffect, useState } from "react";

// The nation-selection globe's fade-in clock (GlobePanel). Kept as a shared
// constant so any future launch-to-nation-select handoff runs on the same clock.
export const GLOBE_TRANSITION_MS = 650;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * True two animation frames after `active` becomes true (so a CSS opacity
 * transition actually animates instead of starting pre-toggled), or
 * immediately under prefers-reduced-motion. False whenever `active` is false.
 */
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
