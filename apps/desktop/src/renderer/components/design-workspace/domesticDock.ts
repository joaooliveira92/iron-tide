import {
  dockRecordFor,
  newConstructionDockEligibility,
  yardDemandOf,
  type DesignDraft,
  type DockEligibility,
  type DockRecord,
  type ShipContext,
  type WorkshopView,
} from "@bluewave/ship-design";

export function domesticDock(ctx: ShipContext): DockRecord | null {
  return ctx.navalProfile === undefined ? null : dockRecordFor(ctx.navalProfile);
}

export function domesticDockEligibility(
  ctx: ShipContext,
  draft: DesignDraft,
  view: Pick<WorkshopView, "compiled">,
): DockEligibility | null {
  const dock = domesticDock(ctx);
  if (dock === null) return null;
  return newConstructionDockEligibility(dock, yardDemandOf(view.compiled, draft));
}
