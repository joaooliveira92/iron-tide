import type { BatteryCard } from "../../components/design-workspace/batteryView.js";
import type { FormTarget } from "../../components/design-workspace/selection/navigation.js";
import { placeOf, type InspectorPlace } from "./design-sections.js";
import { placeForEntity, type RoutingContext } from "./selection.js";

const PANEL_PLACE = {
  brief: placeOf("overview", "brief"),
  hull: placeOf("hull", "dimensions"),
  machinery: placeOf("machinery", "propulsion"),
  protection: placeOf("protection", "armour"),
  batteries: placeOf("armament", "main"),
  placements: placeOf("armament", "main"),
} as const;

const FINDINGS_PLACE = placeOf("review", "findings");

export function placeForDestination(
  target: FormTarget,
  ctx: RoutingContext & { readonly batteries: readonly BatteryCard[] },
): InspectorPlace {
  switch (target.kind) {
    case "panel":
      return PANEL_PLACE[target.panel];
    case "finding":
      return FINDINGS_PLACE;
    case "placement":
      return (
        placeForEntity({ kind: "fitting", instanceId: target.instanceId }, ctx) ??
        PANEL_PLACE.placements
      );
    case "battery": {
      const mount = ctx.batteries.find((card) => card.row.key === target.key)?.mounts[0];
      const place =
        mount === undefined
          ? null
          : placeForEntity({ kind: "fitting", instanceId: mount.instanceId }, ctx);
      return place ?? PANEL_PLACE.batteries;
    }
  }
}
