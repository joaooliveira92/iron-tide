import type { ReactNode } from "react";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { ArmamentEditingProvider } from "./armament/ArmamentEditing.js";
import { MountDetail } from "./armament/MountDetail.js";
import { ArmamentMounts } from "./armament/MountList.js";

export const ArmamentEditor = Object.assign(ArmamentEditorRoot, {
  Mounts: ArmamentMounts,
  Detail: MountDetail,
});

function ArmamentEditorRoot({
  children,
  ...editing
}: {
  readonly children: ReactNode;
} & Omit<Parameters<typeof ArmamentEditingProvider>[0], "children">) {
  return (
    <ArmamentEditingProvider {...editing}>
      <Panel title="Batteries">{children}</Panel>
    </ArmamentEditingProvider>
  );
}
