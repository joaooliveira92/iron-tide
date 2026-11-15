import type { DraftEdit, ZoneId } from "@bluewave/ship-design";
import type { ArmamentMount } from "./armament.js";

export function replaceEdit(mount: ArmamentMount, componentId: string): DraftEdit {
  return {
    kind: "batch",
    edits: [
      { kind: "remove_placement", instanceId: mount.instanceId },
      {
        kind: "add_placement",
        placement: {
          instanceId: mount.instanceId,
          componentId,
          zoneId: mount.zoneId as ZoneId,
          stationPermille: mount.stationPermille,
          side: mount.side,
        },
      },
    ],
  };
}
