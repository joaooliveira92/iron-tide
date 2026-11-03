import type { ReactNode } from "react";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { ProtectionEditingProvider } from "./protection/ProtectionEditing.js";
import { ProtectionAddRegion } from "./protection/ProtectionAddRegion.js";
import { ProtectionCoverage } from "./protection/ProtectionCoverage.js";
import { ProtectionNotes } from "./protection/ProtectionNotes.js";
import { ProtectionRegions } from "./protection/ProtectionRegions.js";
import { ProtectionScheme } from "./protection/ProtectionScheme.js";

export const ProtectionEditor = Object.assign(ProtectionEditorRoot, {
  Coverage: ProtectionCoverage,
  Scheme: ProtectionScheme,
  Regions: ProtectionRegions,
  AddRegion: ProtectionAddRegion,
  Notes: ProtectionNotes,
});

function ProtectionEditorRoot({
  children,
  ...editing
}: {
  readonly children: ReactNode;
} & Omit<Parameters<typeof ProtectionEditingProvider>[0], "children">) {
  return (
    <ProtectionEditingProvider {...editing}>
      <Panel.Root label="Protection">
        <Panel.Body variant="standalone">{children}</Panel.Body>
      </Panel.Root>
    </ProtectionEditingProvider>
  );
}
