import { createContext, useContext, type ReactNode } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";

/**
 * The renderer's transport port. Screens and hooks depend on this interface
 * rather than the `window.bluewave` preload global directly, so tests and
 * embedding can supply a fake without stubbing globals. `undefined` is a valid
 * provided value (no bridge — hair-trigger failure paths); it is distinguished
 * from "no provider" by a sentinel so the preload global stays the fallback.
 */
const NOT_PROVIDED = Symbol("bluewave.bridge.not-provided");

const BridgeContext = createContext<BluewaveDesktopBridge | undefined | typeof NOT_PROVIDED>(
  NOT_PROVIDED,
);

export interface BridgeProviderProps {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly children: ReactNode;
}

export function BridgeProvider({ bridge, children }: BridgeProviderProps) {
  return <BridgeContext.Provider value={bridge}>{children}</BridgeContext.Provider>;
}

/** The transport port for the current tree. Falls back to `window.bluewave`
 * when no `BridgeProvider` is above (keeps bare component tests working). */
export function useBridge(): BluewaveDesktopBridge | undefined {
  const value = useContext(BridgeContext);
  return value === NOT_PROVIDED ? window.bluewave : value;
}
