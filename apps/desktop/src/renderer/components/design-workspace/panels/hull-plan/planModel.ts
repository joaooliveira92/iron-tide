import type { DesignDraft, PartCatalogueEntry, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { type BatteryCard, batteryCards, mountNameMap } from "../../batteryView.js";
import type { ShipEntity } from "../../selection/store.js";
import { boardFindings, entityWarns, type BoardFinding } from "../../validation/boardFindings.js";
import type { DrawingFacts } from "./describe.js";
import type { FittingTarget } from "./FittingTargets.js";
import { funnelPlacements } from "./funnelPlacements.js";
import { bowStyleFor, planFrame, type PlanFrame, sternStyleFor } from "./geometry.js";
import type { FunnelInput } from "./profile-structures.js";
import { SECTIONS, type ZoneRange } from "./sections.js";
import type { VisualMountInput } from "@bluewave/ship-visual";
import { type VisualLook, visualLook, visualMountInputs } from "./visualMounts.js";
import { type MastSummary, mastSummary } from "./profile-masts.js";

/**
 * Everything the hull-plan view renders, derived once from the draft, its compile and the catalogue. Pure and
 * read-only: the drawing shows this and nothing invents values. `findings` may be supplied by the board so the
 * plan and the board agree on one findings list; otherwise it is derived here for the plan shown on its own.
 */
export interface PlanModel {
  readonly form: DrawingBoardContent["hullForms"][number] | undefined;
  readonly frame: PlanFrame;
  readonly zones: readonly ZoneRange[];
  /** The parts-derived catalogue lookup for the edit and read-only paths. */
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  /** Family-level catalogue entries that can be fitted this month. */
  readonly available: readonly PartCatalogueEntry[];
  readonly mounts: readonly { instanceId: string; effectiveBeamArcDeg: number }[];
  readonly batteries: readonly BatteryCard[];
  readonly mountNames: ReadonlyMap<string, string>;
  readonly findings: readonly BoardFinding[];
  /** Per-fitting identity for the overlay: display name and conventional mount name. */
  readonly targets: ReadonlyMap<string, FittingTarget>;
  readonly superstructure: ZoneRange | undefined;
  readonly placedFunnels: readonly FunnelInput[];
  /** The compiled placements as the ship-visual catalog reads them, and the look they are drawn in. */
  readonly visualMounts: readonly VisualMountInput[];
  readonly look: VisualLook;
  /** The masts the profile draws, for the legend; undefined when none is. */
  readonly masts: MastSummary | undefined;
  readonly facts: DrawingFacts;
  readonly warns: (entity: ShipEntity) => boolean;
  readonly entityName: (entity: ShipEntity) => string;
}

export function planModel(
  draft: DesignDraft,
  content: DrawingBoardContent,
  view: WorkshopView,
  month: string,
  given?: readonly BoardFinding[],
): PlanModel {
  const form = content.hullForms.find((f) => f.id === draft.hull.hullFormId);
  const frame = planFrame(
    draft.hull,
    form && {
      waterplaneCoeffBp: form.waterplaneCoeffBp,
      lcbPermille: form.lcbPermille,
      bow: bowStyleFor(form.id),
      stern: sternStyleFor(form.id),
    },
  );
  const zones = form?.zones ?? [];
  const entryOf = (id: string) => content.catalogue.find((e) => e.id === id);
  const available = content.catalogue.filter((e) => e.introduction.fromMonth <= month);
  const mounts = view.compiled.weapons?.mounts ?? [];
  const batteries = batteryCards(view, draft);
  const mountNames = mountNameMap(batteries);
  const findings = given ?? boardFindings(view, draft, batteries);
  const targets = new Map(
    draft.placements.map((p) => [
      p.instanceId,
      {
        instanceId: p.instanceId,
        name: entryOf(p.componentId)?.displayName ?? p.componentId,
        mount: mountNames.get(p.instanceId),
      },
    ]),
  );
  const superstructure = zones.find((z) => z.id === "SUPERSTRUCTURE");
  const placedFunnels = funnelPlacements(draft, content);
  const look = visualLook(draft.nationId, month);
  const facts: DrawingFacts = {
    hullFormId: form?.id,
    lengthM: frame.lengthM,
    beamM: frame.beamM,
    depthM: Number(draft.hull.depthToMainDeck) / 1000,
    draughtM: Number(draft.hull.draught) / 1000,
    bow: frame.bow,
    stern: frame.stern,
    fittings: draft.placements.length,
    funnels: placedFunnels.length,
    superstructure,
  };
  const entityName = (e: ShipEntity): string => {
    switch (e.kind) {
      case "ship":
        return "whole ship";
      case "section":
        return SECTIONS[e.id].name;
      case "fitting": {
        const t = targets.get(e.instanceId);
        return t ? `${t.name}${t.mount ? `, mount ${t.mount}` : ""}` : e.instanceId;
      }
      case "machinery-room":
        return `machinery room ${e.index + 1}`;
    }
  };
  return {
    form,
    frame,
    zones,
    entryOf,
    available,
    mounts,
    batteries,
    mountNames,
    findings,
    targets,
    superstructure,
    placedFunnels,
    visualMounts: visualMountInputs(draft, view),
    look,
    masts: mastSummary(look, superstructure !== undefined),
    facts,
    warns: (entity) => entityWarns(entity, findings),
    entityName,
  };
}
