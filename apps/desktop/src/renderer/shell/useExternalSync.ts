import { useEffect, useLayoutEffect, type DependencyList } from "react";

export type ExternalSync = () => void | (() => void);

export function useExternalSync(sync: ExternalSync, deps: DependencyList): void {
  useEffect(sync, deps);
}

export function useExternalLayoutSync(sync: ExternalSync, deps: DependencyList): void {
  useLayoutEffect(sync, deps);
}
