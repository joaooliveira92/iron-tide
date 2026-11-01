import { memo, useMemo, useRef, useState } from "react";
import type { ArmourRegionId, DesignDraft, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { Checkbox } from "../../../ui/checkbox.js";
import { Panel } from "../Panel.js";
import { PLAN_H, PLAN_W } from "./geometry.js";
import type { PlanFrame } from "./geometry.js";
import { planLabel } from "./describe.js";
import { HullPlanLegend } from "./HullPlanLegend.js";
import { legendEntries } from "./legend.js";
import { PlanContextMenu } from "./PlanContextMenu.js";
import { PlanToolOptions } from "./PlanToolbar.js";
import { clientToPlan, fittingAt } from "./plan-pointer.js";
import type { ZoneSpan } from "./plan-targeting.js";
import { ProfileView } from "./ProfileView.js";
import { SectionCard } from "./SectionCard.js";
import { SectionLabels } from "./SectionLabels.js";
import { FindingMarkers, layoutMarkers } from "../../validation/FindingMarkers.js";
import type { ShipEntity } from "../../selection/store.js";
import {
  FindingsControl,
  useFindingsView,
  type FindingsView,
} from "../../validation/FindingsControl.js";
import { passesFilter } from "../../validation/severity.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover.js";
import { FittingTargets } from "./FittingTargets.js";
import { SelectionLayer } from "./SelectionLayer.js";
import { ARC_R_FOCUS, GunArcLayer, HullFittingLayer } from "./fitting-layers.js";
import { HullDeckLayer, HullOutlineLayer, HullZoneLayer } from "./plan-layers.js";
import { HullTopsideLayer } from "./HullTopsideLayer.js";
import {
  ArmourZoneLayer,
  CompartmentLayer,
  MachineryLayoutLayer,
  MassMarkersLayer,
} from "./ship-view-layers.js";
import { DEFAULT_VIEW, SHIP_VIEW_DEFS, type ShipOverlay, type ShipView } from "./ship-view.js";
import { AnatomyShipFigure } from "./anatomy/AnatomyShipFigure.js";
import { buildAnatomyShip } from "./anatomy/ship-anatomy.js";
import { fittingKind } from "./sections.js";
import { planSymbolFor } from "./plan-symbols.js";
import { planModel, type PlanModel } from "./planModel.js";
import { useHullPlanEditing, type HullPlanEditing } from "./useHullPlanEditing.js";
import { Info } from "lucide-react";
import { cn } from "../../../../lib/utils.js";
import { formatHullMetres } from "../../../../lib/presentation-format/hull-metres.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import { plural } from "../../plural.js";
import type { BoardFinding } from "../../validation/boardFindings.js";
import type { PlanTool } from "./plan-tool.js";
import type { Edit } from "../types.js";

const ISO_HEIGHT =
  "calc(100svh - var(--chrome-top, 0px) - var(--chrome-bottom, 0px) - var(--chrome-slip, 0px) - 7rem)";

const NO_FINDINGS: readonly BoardFinding[] = [];

function PlanDragGhost({
  useGhostPosition,
}: {
  readonly useGhostPosition: HullPlanEditing["useGhostPosition"];
}) {
  const at = useGhostPosition();
  return at === null ? null : (
    <circle
      cx={at.x}
      cy={at.y}
      r={7}
      fill="none"
      stroke="currentColor"
      strokeDasharray="3 2"
      pointerEvents="none"
      data-testid="plan-drag-ghost"
      aria-hidden="true"
    />
  );
}

const PlanConflictMarkers = memo(function PlanConflictMarkers({
  shown,
  visible,
  frame,
  draft,
  zones,
  names,
  hidden,
}: {
  readonly shown: readonly BoardFinding[];
  readonly visible: boolean;
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly zones: readonly ZoneSpan[];
  readonly names: (entity: ShipEntity) => string;
  readonly hidden: boolean;
}) {
  const groups = visible ? layoutMarkers(shown, frame, draft, zones) : [];
  return groups.length === 0 ? null : (
    <FindingMarkers groups={groups} names={names} hidden={hidden} />
  );
});

export function HullPlanPanel({
  draft,
  content,
  view,
  month,
  edit,
  findings: given,
  model: givenModel,
  editing: givenEditing,
  tool: givenTool,
  onTool,
  showArcs: givenShowArcs,
  onShowArcs,
  findingsView: givenFindingsView,
  onFindingsView,
  shipView: givenShipView,
  overlays: givenOverlays,
  armourHighlight,
  isoSide = "starboard",
  highlightId,
  focusArcs = false,
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly view: WorkshopView;
  readonly month: string;
  readonly edit: Edit;
  readonly findings?: readonly BoardFinding[];
  readonly model?: PlanModel;
  readonly editing?: HullPlanEditing;
  readonly tool?: PlanTool;
  readonly onTool?: (next: PlanTool) => void;
  readonly showArcs?: boolean;
  readonly onShowArcs?: (next: boolean) => void;
  readonly findingsView?: FindingsView;
  readonly onFindingsView?: (next: FindingsView) => void;
  readonly shipView?: ShipView;
  readonly overlays?: ReadonlySet<ShipOverlay>;
  readonly armourHighlight?: ArmourRegionId | null;
  readonly isoSide?: "starboard" | "port";
  readonly highlightId?: string;
  readonly focusArcs?: boolean;
}) {
  const format = usePresentationFormat();
  const [localShowArcs, setLocalShowArcs] = useState(true);
  const [localFindingsView, setLocalFindingsView] = useFindingsView();
  const showArcs = givenShowArcs ?? localShowArcs;
  const setShowArcs = onShowArcs ?? setLocalShowArcs;
  const findingsView = givenFindingsView ?? localFindingsView;
  const setFindingsView = onFindingsView ?? setLocalFindingsView;
  const showArcsControl = onShowArcs === undefined && givenOverlays === undefined;
  const findingsControl = onFindingsView === undefined;
  const planRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const givenFindings = given ?? NO_FINDINGS;
  const fallback = useMemo(
    () => planModel(draft, content, view, month, given),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- given drives recompute via givenFindings
    [draft, content, view, month, givenFindings],
  );
  const model = givenModel ?? fallback;
  const ownEditing = useHullPlanEditing({
    draft,
    content,
    month,
    frame: model.frame,
    zones: model.zones,
    entryOf: model.entryOf,
    edit,
    givenTool,
    onTool,
  });
  const editing = givenEditing ?? ownEditing;
  const { tool, notice, useGhostPosition, planHandlers, onNudge, onSide } = editing;
  const { frame, zones, form, facts, superstructure, placedFunnels, mounts, targets } = model;
  const shown = useMemo(
    () => model.findings.filter((f) => passesFilter(f.severity, findingsView.filter)),
    [model.findings, findingsView.filter],
  );
  const viewDef = SHIP_VIEW_DEFS[givenShipView ?? DEFAULT_VIEW];
  const drawing = viewDef.id;
  const overlaysGiven = givenOverlays !== undefined;
  const on = (overlay: ShipOverlay) => givenOverlays === undefined || givenOverlays.has(overlay);
  const arcsOn = (overlaysGiven ? on("arcs") : true) && showArcs;
  const fittingUnder = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const point = rect && clientToPlan(rect, clientX, clientY);
    return point ? fittingAt(frame, draft, point.x, point.y) : null;
  };
  const lcgPermille = view.compiled.stability?.lcgPermille;
  const starboard = useMemo(
    () => (drawing === "side" ? null : buildAnatomyShip({ draft, view, model, azimuth: 135 })),
    [drawing, draft, view, model],
  );
  const port = useMemo(
    () =>
      drawing === "top" || (drawing === "iso" && isoSide === "port")
        ? buildAnatomyShip({ draft, view, model, azimuth: 225 })
        : null,
    [drawing, isoSide, draft, view, model],
  );
  const anatomy = starboard !== null && port !== null ? { starboard, port } : undefined;
  const isoShip = isoSide === "port" ? port : starboard;
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
  return (
    <Panel
      title="Hull plan"
      compact={givenShipView !== undefined}
      className="rounded-none border-0 bg-transparent"
    >
      {drawing === "top" && (
        <PlanToolOptions
          tool={tool}
          draft={draft}
          entryOf={model.entryOf}
          notice={notice}
          onNudge={onNudge}
          onSide={onSide}
          onDone={() => editing.setTool({ ...tool, mode: "off" })}
        />
      )}
      {showArcsControl && (
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="show-gun-arcs"
            aria-label="Show gun arcs"
            checked={showArcs}
            onCheckedChange={(v) => setShowArcs(v === true)}
          />
          <span aria-hidden="true">Show gun arcs</span>
        </div>
      )}
      {findingsControl && (
        <FindingsControl
          view={findingsView}
          onChange={setFindingsView}
          shipFindings={shown.filter((f) => f.entities.some((e) => e.kind === "ship"))}
        />
      )}
      {drawing === "top" && (
        <div className="space-y-1" ref={planRef}>
          <PlanContextMenu
            tool={tool}
            onTool={editing.setTool}
            draft={draft}
            available={model.available}
            entryOf={model.entryOf}
            onAutoPlace={editing.onAutoPlace}
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
                <SelectionLayer frame={frame} zones={zones} draft={draft} warned={model.warned} />
                <HullZoneLayer frame={frame} zones={zones} />
                {givenOverlays?.has("compartments") === true && (
                  <CompartmentLayer frame={frame} zones={zones} />
                )}
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
                warned={model.warned}
                anatomy={anatomy}
              />
              {on("conflicts") && (
                <PlanConflictMarkers
                  shown={shown}
                  visible={findingsView.visible}
                  frame={frame}
                  draft={draft}
                  zones={zones}
                  names={model.entityName}
                  hidden={tool.mode !== "off"}
                />
              )}
            </div>
          </PlanContextMenu>
          <SectionLabels
            numbered={givenOverlays?.has("compartments") === true}
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
      )}
      {drawing === "side" && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Profile · depth {formatHullMetres(facts.depthM, 1)} m · draught{" "}
            {formatHullMetres(facts.draughtM, 1)} m
          </p>
          <ProfileView
            draft={draft}
            content={content}
            sheerBp={form?.sheerBp ?? 10000}
            bow={frame.bow}
            stern={frame.stern}
            lcbPermille={frame.lcbPermille}
            superstructure={superstructure}
            facts={facts}
            mounts={model.visualMounts}
            look={model.look}
          />
        </div>
      )}
      {drawing === "iso" && isoShip !== null && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Seen from the {isoSide} side</p>
          <AnatomyShipFigure
            ship={isoShip}
            highlight={highlightId}
            className="mx-auto min-h-64"
            style={{ height: ISO_HEIGHT }}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {formatHullMetres(frame.lengthM, 0)} m × {formatHullMetres(frame.beamM, 1)} m ·{" "}
          {plural(draft.placements.length, "fitting", undefined, undefined, format)} · Schematic,
          not a lines plan.
        </span>
        <Popover>
          <PopoverTrigger
            render={<button type="button" />}
            className="inline-flex items-center gap-1 rounded underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info aria-hidden="true" className="size-3" />
            Drawing key
          </PopoverTrigger>
          <PopoverContent aria-label="Drawing key" className="w-80 space-y-3 text-xs">
            <HullPlanLegend
              entries={legendEntries(
                {
                  facts,
                  waterplaneCoeffBp: form?.waterplaneCoeffBp,
                  lcbPermille: form?.lcbPermille,
                  sheerBp: form?.sheerBp,
                  funnels: placedFunnels,
                  masts: model.masts,
                },
                format,
              )}
            />
            <p>
              Schematic design views, not construction drawings or a true lines plan. The hull
              form's waterplane coefficient, LCB, sheer and the placed fittings drive the drawing;
              bow and stern character, sheer emphasis, deck-house steps and funnel shape are visual
              conventions. Of the fittings, station, side and arc width are data, and so are a gun's
              calibre, gun count and mount type; the mount's silhouette follows the designing nation
              and period, a convention. Arcs show the effective beam arc after obstruction.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </Panel>
  );
}
