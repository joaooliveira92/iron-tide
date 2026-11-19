import { useCallback, useSyncExternalStore } from "react";

const hasMatchMedia = (): boolean => typeof window.matchMedia === "function";

export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!hasMatchMedia()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  const read = useCallback(
    () => (hasMatchMedia() ? window.matchMedia(query).matches : true),
    [query],
  );
  return useSyncExternalStore(subscribe, read);
}
