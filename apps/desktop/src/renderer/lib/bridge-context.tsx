import { createContext, useContext, type ReactNode } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";

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

export function useBridge(): BluewaveDesktopBridge | undefined {
  const value = useContext(BridgeContext);
  return value === NOT_PROVIDED ? window.bluewave : value;
}
