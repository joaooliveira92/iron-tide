import type { ReactNode } from "react";
import { Panel } from "../Panel.js";

export function RebuildShell({
  children,
  hideTitle = false,
}: {
  readonly children: ReactNode;
  readonly hideTitle?: boolean;
}) {
  return (
    <Panel title="Rebuild a ship" hideTitle={hideTitle}>
      {children}
    </Panel>
  );
}
