import { useMemo, useSyncExternalStore, type DependencyList } from "react";

const NO_CLEANUP = (): void => undefined;
const LIFECYCLE_SNAPSHOT = (): number => 0;

export function useLifecycle(start: () => void | (() => void), key: DependencyList): void {
  const subscribe = useMemo(
    () => (): (() => void) => {
      const stop = start();
      return typeof stop === "function" ? stop : NO_CLEANUP;
    },
    key,
  );
  useSyncExternalStore(subscribe, LIFECYCLE_SNAPSHOT);
}
