import { useMemo, useRef } from "react";
import type { ArmourRegionId, DesignDraft, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import type { BoardFinding } from "../../validation/boardFindings.js";
import { cn } from "../../../../lib/utils.js";
import { planLabel } from "./describe.js";
import { PLAN_H, PLAN_W } from "./geometry.js";
import { FittingTargets } from "./FittingTargets.js";
import { ARC_R_FOCUS, GunArcLayer, HullFittingLayer } from "./fitting-layers.js";
import { PlanConflictMarkers } from "./PlanConflictMarkers.js";
import { PlanContextMenu } from "./PlanContextMenu.js";
import { PlanDragGhost } from "./PlanDragGhost.js";
import { HullDeckLayer, HullOutlineLayer, HullZoneLayer } from "./plan-layers.js";
import { clientToPlan, fittingAt } from "./plan-pointer.js";
import { planSymbolFor } from "./plan-symbols.js";
import type { PlanModel } from "./planModel.js";
import { SectionCard } from "./SectionCard.js";
import { SectionLabels } from "./SectionLabels.js";
import { SelectionLayer } from "./SelectionLayer.js";
import { fittingKind } from "./sections.js";
import type { AnatomyShip } from "./anatomy/anatomy-types.js";
import type { ShipOverlay } from "./ship-view.js";
import {
  ArmourZoneLayer,
  CompartmentLayer,
  MachineryLayoutLayer,
  MassMarkersLayer,
} from "./ship-view-layers.js";
import { HullTopsideLayer } from "./HullTopsideLayer.js";
import type { HullPlanEditing } from "./useHullPlanEditing.js";

export function HullPlanTopView({
  draft,
  content,
  view,
  model,
  editing,
  overlays,
  showArcs,
  focusArcs,
  armourHighlight,
  starboard,
  anatomy,
  shown,
  findingsVisible,
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly view: WorkshopView;
  readonly model: PlanModel;
  readonly editing: HullPlanEditing;
  readonly overlays?: ReadonlySet<ShipOverlay>;
  readonly showArcs: boolean;
  readonly focusArcs: boolean;
  readonly armourHighlight?: ArmourRegionId | null;
  readonly starboard: AnatomyShip | null;
  readonly anatomy?: { readonly starboard: AnatomyShip; readonly port: AnatomyShip };
  readonly shown: readonly BoardFinding[];
  readonly findingsVisible: boolean;
}) {
  const planRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { frame, zones, form, facts, mounts, targets, warned, entityName, available, entryOf } =
    model;
  const { tool, setTool, onAutoPlace, planHandlers, useGhostPosition } = editing;
  const on = (overlay: ShipOverlay) => overlays === undefined || overlays.has(overlay);
  const arcsOn = on("arcs") && showArcs;
  const compartments = overlays?.has("compartments") === true;
  const lcgPermille = view.compiled.stability?.lcgPermille;
  const symbolOf = useMemo(() => {
    const mountOf = new Map(model.visualMounts.map((m) => [m.instanceId, m]));
    return (p: DesignDraft["placements"][number]) => {
      const entry = model.entryOf(p.componentId);
      if (entry === undefined) return undefined;
      const mount = mountOf.get(p.instanceId);
      return planSymbolFor({
        kind: fittingKind(entry.category, entry.tags),
        category: entry.category,
        mountType: mount?.mountType,
        gunCount: mount?.gunCount,
        caliberUm: mount?.caliberUm,
      });
    };
  }, [model]);
  const fittingUnder = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const point = rect && clientToPlan(rect, clientX, clientY);
    return point ? fittingAt(frame, draft, point.x, point.y) : null;
  };
  return (
    <div className="space-y-1" ref={planRef}>
      <PlanContextMenu
        tool={tool}
        onTool={setTool}
        draft={draft}
        available={available}
        entryOf={entryOf}
        onAutoPlace={onAutoPlace}
        fittingAt={fittingUnder}
      >
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
            className={cn(
              "block w-full rounded bg-muted/40",
              tool.mode !== "off" && "ring-2 ring-primary/50",
            )}
            role="img"
            aria-label={planLabel(facts)}
          >
            <HullOutlineLayer frame={frame} />
            <HullDeckLayer frame={frame} />
            <SelectionLayer frame={frame} zones={zones} draft={draft} warned={warned} />
            <HullZoneLayer frame={frame} zones={zones} />
            {compartments && <CompartmentLayer frame={frame} zones={zones} />}
            {on("armour") && starboard !== null && (
              <ArmourZoneLayer
                frame={frame}
                draft={draft}
                highlight={armourHighlight}
                anatomy={starboard}
              />
            )}
            {on("topside") && (
              <HullTopsideLayer frame={frame} draft={draft} content={content} zones={zones} />
            )}
            {on("mass") && lcgPermille !== undefined && (
              <MassMarkersLayer frame={frame} lcgPermille={lcgPermille} />
            )}
            {on("machinery") && <MachineryLayoutLayer frame={frame} draft={draft} />}
            {arcsOn && (
              <GunArcLayer
                frame={frame}
                draft={draft}
                mounts={mounts}
                radius={focusArcs ? ARC_R_FOCUS : undefined}
                labelled={focusArcs}
              />
            )}
            {on("footprint") && (
              <HullFittingLayer
                frame={frame}
                draft={draft}
                selectedId={tool.mode === "move" ? tool.instanceId : undefined}
                symbolOf={symbolOf}
              />
            )}
            {tool.mode !== "off" && (
              <rect
                x={0}
                y={0}
                width={PLAN_W}
                height={PLAN_H}
                fill="transparent"
                className="cursor-crosshair"
                aria-hidden="true"
                data-testid="plan-click-layer"
                {...planHandlers}
              />
            )}
            <PlanDragGhost useGhostPosition={useGhostPosition} />
          </svg>
          <FittingTargets
            frame={frame}
            draft={draft}
            targets={targets}
            disabled={tool.mode !== "off"}
            warned={warned}
            anatomy={anatomy}
          />
          {on("conflicts") && (
            <PlanConflictMarkers
              shown={shown}
              visible={findingsVisible}
              frame={frame}
              draft={draft}
              zones={zones}
              names={entityName}
              hidden={tool.mode !== "off"}
            />
          )}
        </div>
      </PlanContextMenu>
      <SectionLabels
        numbered={compartments}
        zones={zones}
        anchor={planRef}
        renderCard={(id) => (
          <SectionCard
            id={id}
            ctx={{ draft, view, content, zones, frame, sheerBp: form?.sheerBp ?? 10000 }}
          />
        )}
      />
    </div>
  );
}
