import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(notify: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

const read = (): boolean => window.matchMedia(MOBILE_QUERY).matches;
const readServer = (): boolean => false;

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, read, readServer);
}
