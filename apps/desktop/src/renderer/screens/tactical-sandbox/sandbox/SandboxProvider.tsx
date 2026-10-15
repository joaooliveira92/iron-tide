import type { ReactNode } from "react";

import { SandboxContext, type SandboxBridge } from "./sandbox-context.js";
import { useSandboxController } from "./useSandboxController.js";

export function SandboxProvider({
  sessionId,
  bridge,
  children,
}: {
  readonly sessionId: string;
  readonly bridge?: SandboxBridge;
  readonly children: ReactNode;
}) {
  const value = useSandboxController(sessionId, bridge);
  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}
