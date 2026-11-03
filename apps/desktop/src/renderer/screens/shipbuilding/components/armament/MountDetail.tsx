import { Badge } from "../../../../components/ui/badge.js";
import { placementAttrs } from "../../../../components/design-workspace/selection/navigation.js";
import { useArmamentEditing } from "./ArmamentEditing.js";
import { MountActions } from "./MountActions.js";
import { MountConflicts } from "./MountConflicts.js";
import { MountFields } from "./MountFields.js";
import { MountReadouts } from "./MountReadouts.js";
import { MountReplace } from "./MountReplace.js";

export function MountDetail() {
  const { selected } = useArmamentEditing();
  if (selected === null) return null;
  return (
    <div className="space-y-3 rounded-md border p-3" {...placementAttrs(selected.instanceId)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{selected.layout}</span>
        <Badge variant="outline">{selected.displayName}</Badge>
      </div>
      <MountReadouts />
      <MountFields />
      <MountActions />
      <MountReplace />
      <MountConflicts />
    </div>
  );
}
