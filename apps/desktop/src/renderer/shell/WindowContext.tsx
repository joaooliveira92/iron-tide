import { createContext, type ReactNode, use } from "react";

import type { WindowState } from "../../shared/bridge-contract.js";

export interface TitlebarConfig {
  title: string;
  titleCentered?: boolean;
  icon?: string;
}

export interface WindowContextValue {
  platform: NodeJS.Platform;
  windowState: WindowState;
  titlebar: TitlebarConfig;
  windowMinimize: () => void;
  windowMaximizeToggle: () => void;
  windowClose: () => void;
}

const WindowContext = createContext<WindowContextValue | null>(null);

export function WindowContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WindowContextValue;
}) {
  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

export function useWindowContext(): WindowContextValue {
  const ctx = use(WindowContext);
  if (ctx === null) throw new Error("useWindowContext must be used within WindowContextProvider");
  return ctx;
}
