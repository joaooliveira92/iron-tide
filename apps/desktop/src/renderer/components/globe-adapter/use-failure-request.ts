import { useSyncExternalStore } from "react";
import { adapterFailureRequested } from "./globe-adapter-flag.js";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function snapshot(): boolean {
  return adapterFailureRequested(window.location.hash);
}

export function useAdapterFailureRequested(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
