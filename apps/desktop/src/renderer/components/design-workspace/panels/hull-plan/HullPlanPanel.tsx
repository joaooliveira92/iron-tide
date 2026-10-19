import { useMemo, useRef, useState } from "react";
import type { ArmourRegionId, DesignDraft, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { Checkbox } from "../../../ui/checkbox.js";
import { Panel } from "../Panel.js";
import { PLAN_H, PLAN_W } from "./geometry.js";
import { planLabel } from "./describe.js";
import { HullPlanLegend } from "./HullPlanLegend.js";
import { legendEntries } from "./legend.js";
import { PlanToolOptions } from "./PlanToolbar.js";
import { ProfileView } from "./ProfileView.js";
import { SectionCard } from "./SectionCard.js";
import { SectionLabels } from "./SectionLabels.js";
import { FindingMarkers, layoutMarkers } from "../../validation/FindingMarkers.js";
import {
  FindingsControl,
  useFindingsView,
  type FindingsView,
} from "../../validation/FindingsControl.js";
import { passesFilter } from "../../validation/severity.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover.js";
import { FittingTargets } from "./FittingTargets.js";
import { SelectionLayer } from "./SelectionLayer.js";
import { GunArcLayer, HullFittingLayer } from "./fitting-layers.js";
import { HullOutlineLayer, HullZoneLayer } from "./plan-layers.js";
import { HullTopsideLayer } from "./HullTopsideLayer.js";
import {
  ArmourZoneLayer,
  CompartmentLayer,
  MachineryLayoutLayer,
  MassMarkersLayer,
} from "./ship-view-layers.js";
import { DEFAULT_VIEW, SHIP_VIEW_DEFS, type ShipOverlay, type ShipView } from "./ship-view.js";
import { buildAnatomyShip } from "./anatomy/ship-anatomy.js";
import { planModel, type PlanModel } from "./planModel.js";
import { useHullPlanEditing, type HullPlanEditing } from "./useHullPlanEditing.js";
import { Info } from "lucide-react";
import { formatHullMetres } from "../../../../lib/presentation-format/index.js";
import { plural } from "../../plural.js";
import type { BoardFinding } from "../../validation/boardFindings.js";
import type { PlanTool } from "./plan-tool.js";
import type { Edit } from "../types.js";

/**
 * Top-down plan of the hull, composed of layers: outline, zones, topside, gun arcs, fittings; plus a side profile.
 *
 * SCHEMATIC GEOMETRY: the outline is a parametric waterline scaled to length and beam. Its area follows the
 * hull form's waterplane coefficient and its bow/stern fullness follows the form's LCB, but it is not the
 * form's real lines, and centreline fittings are nudged apart vertically so overlapping dots stay
 * visible (the nudge carries no meaning). Arc wedges have a fixed drawn radius (range is not shown). Only
 * the station (x), the port/starboard side and the arc width are data. Do not treat this as an
 * authoritative hull-form visualisation.
 */
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
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly view: WorkshopView;
  readonly month: string;
  readonly edit: Edit;
  /** The board's findings (`boardFindings`); derived here only when the plan is shown on its own. */
  readonly findings?: readonly BoardFinding[];
  /** The board's derived plan model; built here only when the plan is shown on its own. */
  readonly model?: PlanModel;
  /** The board's plan-editing (tool, notice, click/drag handlers); the plan keeps its own only when shown on its own. */
  readonly editing?: HullPlanEditing;
  /** The plan tool, switched from the board toolbar; the plan keeps its own only when it is shown on its own. */
  readonly tool?: PlanTool;
  readonly onTool?: (next: PlanTool) => void;
  /** Whether the gun arcs are drawn; the board toolbar owns it, the plan only when shown on its own. */
  readonly showArcs?: boolean;
  readonly onShowArcs?: (next: boolean) => void;
  /** Which findings show on the plan; the board toolbar owns it, the plan only when shown on its own. */
  readonly findingsView?: FindingsView;
  readonly onFindingsView?: (next: FindingsView) => void;
  /**
   * The view the workspace switches between (ticket 04). Omitted, the drawing behaves as the Drawing Board's
   * single top view: every layer is drawn and the gun arcs follow `showArcs`.
   */
  readonly shipView?: ShipView;
  /** The overlays switched on. Omitted, every layer is drawn (the Drawing Board's behaviour). */
  readonly overlays?: ReadonlySet<ShipOverlay>;
  /** The armour region the Protection editor has selected, highlighted on the plan (presentation only). */
  readonly armourHighlight?: ArmourRegionId | null;
}) {
  // Display preferences are lifted to the board toolbar; the plan falls back to its own state when shown on its own.
  const [localShowArcs, setLocalShowArcs] = useState(true);
  const [localFindingsView, setLocalFindingsView] = useFindingsView();
  const showArcs = givenShowArcs ?? localShowArcs;
  const setShowArcs = onShowArcs ?? setLocalShowArcs;
  const findingsView = givenFindingsView ?? localFindingsView;
  const setFindingsView = onFindingsView ?? setLocalFindingsView;
  const showArcsControl = onShowArcs === undefined && givenOverlays === undefined;
  const findingsControl = onFindingsView === undefined;
  const planRef = useRef<HTMLDivElement>(null);
  const model = givenModel ?? planModel(draft, content, view, month, given);
  // The board owns the plan tool when its toolbar (with the pickers) is shown; the plan keeps its own when alone.
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
  const { tool, notice, ghost, planHandlers, onNudge, onSide } = editing;
  const { frame, zones, form, facts, superstructure, placedFunnels, mounts, targets } = model;
  const shown = model.findings.filter((f) => passesFilter(f.severity, findingsView.filter));
  // View and overlays are the workspace's; without them the drawing is the Drawing Board's single top view.
  const viewDef = SHIP_VIEW_DEFS[givenShipView ?? DEFAULT_VIEW];
  const overlaysGiven = givenOverlays !== undefined;
  const on = (overlay: ShipOverlay) => givenOverlays === undefined || givenOverlays.has(overlay);
  const arcsOn = (overlaysGiven ? on("arcs") : true) && showArcs;
  const lcgPermille = view.compiled.stability?.lcgPermille;
  const anatomy = useMemo(
    () => ({
      starboard: buildAnatomyShip({ draft, view, model, azimuth: 135 }),
      port: buildAnatomyShip({ draft, view, model, azimuth: 225 }),
    }),
    [draft, view, model],
  );
  return (
    <Panel title="Hull plan" className="rounded-none border-0 bg-transparent">
      <PlanToolOptions
        tool={tool}
        draft={draft}
        entryOf={model.entryOf}
        notice={notice}
        onNudge={onNudge}
        onSide={onSide}
      />
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
      <div className="space-y-1" ref={planRef} hidden={viewDef.profileOnly}>
        <p className="text-xs font-medium text-muted-foreground">
          {viewDef.profileOnly ? "Waterline plan" : viewDef.hint}
        </p>
        <div className="relative">
          <svg
            viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
            className="block w-full rounded bg-muted/40"
            role="img"
            aria-label={planLabel(facts)}
          >
            <HullOutlineLayer frame={frame} />
            <SelectionLayer frame={frame} zones={zones} draft={draft} warns={model.warns} />
            <HullZoneLayer frame={frame} zones={zones} />
            {viewDef.id === "compartments" && <CompartmentLayer frame={frame} zones={zones} />}
            {on("armour") && (
              <ArmourZoneLayer
                frame={frame}
                draft={draft}
                highlight={armourHighlight}
                anatomy={anatomy.starboard}
              />
            )}
            {on("topside") && (
              <HullTopsideLayer frame={frame} draft={draft} content={content} zones={zones} />
            )}
            {on("mass") && lcgPermille !== undefined && (
              <MassMarkersLayer frame={frame} lcgPermille={lcgPermille} />
            )}
            {on("machinery") && <MachineryLayoutLayer frame={frame} draft={draft} />}
            {arcsOn && <GunArcLayer frame={frame} draft={draft} mounts={mounts} />}
            {on("footprint") && (
              <HullFittingLayer
                frame={frame}
                draft={draft}
                selectedId={tool.mode === "move" ? tool.instanceId : undefined}
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
            {ghost !== null && (
              <circle
                cx={ghost.x}
                cy={ghost.y}
                r={7}
                fill="none"
                stroke="currentColor"
                strokeDasharray="3 2"
                pointerEvents="none"
                data-testid="plan-drag-ghost"
                aria-hidden="true"
              />
            )}
          </svg>
          <FittingTargets
            frame={frame}
            draft={draft}
            targets={targets}
            disabled={tool.mode !== "off"}
            warns={(instanceId) => model.warns({ kind: "fitting", instanceId })}
            anatomy={anatomy}
          />
          {on("conflicts") && (
            <FindingMarkers
              groups={findingsView.visible ? layoutMarkers(shown, frame, draft, zones) : []}
              names={model.entityName}
              hidden={tool.mode !== "off"}
            />
          )}
        </div>
        <SectionLabels
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
      <HullPlanLegend
        entries={legendEntries({
          facts,
          waterplaneCoeffBp: form?.waterplaneCoeffBp,
          lcbPermille: form?.lcbPermille,
          sheerBp: form?.sheerBp,
          funnels: placedFunnels,
          masts: model.masts,
        })}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {formatHullMetres(frame.lengthM, 0)} m × {formatHullMetres(frame.beamM, 1)} m ·{" "}
          {plural(draft.placements.length, "fitting")} · Schematic, not a lines plan.
        </span>
        <Popover>
          <PopoverTrigger
            render={<button type="button" />}
            className="inline-flex items-center gap-1 rounded underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info aria-hidden="true" className="size-3" />
            About this drawing
          </PopoverTrigger>
          <PopoverContent aria-label="About this drawing" className="w-80 text-xs">
            Schematic design views, not construction drawings or a true lines plan. The hull form's
            waterplane coefficient, LCB, sheer and the placed fittings drive the drawing; bow and
            stern character, sheer emphasis, deck-house steps and funnel shape are visual
            conventions. Of the fittings, station, side and arc width are data, and so are a gun's
            calibre, gun count and mount type; the mount's silhouette follows the designing nation
            and period, a convention. Arcs show the effective beam arc after obstruction.
          </PopoverContent>
        </Popover>
      </div>
    </Panel>
  );
}
