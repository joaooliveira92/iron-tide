import { createContext, use } from "react";

import type { BluewaveDesktopBridge } from "../../../../preload/index.js";
import type { TacticalSandboxScreenState } from "../tactical-sandbox-screen-state.js";

export type SandboxBridge = Pick<BluewaveDesktopBridge, "campaign">;

export interface SandboxActions {
  readonly updateWarId: (warId: string) => void;
  readonly updateTurnCount: (turnCount: number) => void;
  readonly updateScriptedOrdersText: (text: string) => void;
  readonly generateBattle: () => void;
  readonly autoResolve: () => void;
  readonly tacticalResolve: () => void;
  readonly replayBoundary: () => void;
}

export interface SandboxContextValue {
  readonly state: TacticalSandboxScreenState;
  readonly actions: SandboxActions;
}

export const SandboxContext = createContext<SandboxContextValue | null>(null);

export function useSandbox(): SandboxContextValue {
  const context = use(SandboxContext);
  if (context === null) {
    throw new Error("useSandbox must be used within SandboxProvider");
  }
  return context;
}
