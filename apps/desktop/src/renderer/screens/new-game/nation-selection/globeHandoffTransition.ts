import { useMemo, useSyncExternalStore } from "react";
import { createValueStore, subscribeWithLifecycle } from "../../../lib/value-store.js";

export const GLOBE_TRANSITION_MS = 650;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function useArmedAfterMount(active: boolean): boolean {
  const { store, subscribe } = useMemo(() => {
    const created = createValueStore(active && prefersReducedMotion());
    return {
      store: created,
      subscribe: subscribeWithLifecycle(created, (target) => {
        if (!active) return;
        if (prefersReducedMotion()) {
          target.set(true);
          return;
        }
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => target.set(true));
        });
        return () => {
          cancelAnimationFrame(raf1);
          cancelAnimationFrame(raf2);
        };
      }),
    };
  }, [active]);

  return useSyncExternalStore(subscribe, store.get);
}
