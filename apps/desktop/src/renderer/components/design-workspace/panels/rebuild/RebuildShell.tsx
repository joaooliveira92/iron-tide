import type { ReactNode } from "react";
import { Panel } from "../Panel.js";

export function RebuildShell({ children }: { readonly children: ReactNode }) {
  return <Panel title="Rebuild a ship">{children}</Panel>;
}
