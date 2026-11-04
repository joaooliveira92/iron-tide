import { useMemo, useState } from "react";
import type { ArmourRegionId } from "@bluewave/ship-design";
import { useDesignActions, useDesignState } from "../../DesignWorkspaceContext.js";
import { Checkbox } from "../../../ui/checkbox.js";
import { Panel } from "../Panel.js";
import { PlanToolOptions } from "./PlanToolbar.js";
import { ProfileView } from "./ProfileView.js";
import { HullPlanStatusBar } from "./HullPlanStatusBar.js";
import { HullPlanTopView } from "./HullPlanTopView.js";
import { passesFilter } from "../../validation/severity.js";
import type { BoardFinding } from "../../validation/boardFindings.js";
import {
  FindingsControl,
  useFindingsView,
  type FindingsView,
} from "../../validation/FindingsControl.js";
import { DEFAULT_VIEW, SHIP_VIEW_DEFS, type ShipOverlay, type ShipView } from "./ship-view.js";
import { AnatomyShipFigure } from "./anatomy/AnatomyShipFigure.js";
import { buildAnatomyShip } from "./anatomy/ship-anatomy.js";
import { planModel, type PlanModel } from "./planModel.js";
import { useHullPlanEditing, type HullPlanEditing } from "./useHullPlanEditing.js";
import { formatHullMetres } from "../../../../lib/presentation-format/hull-metres.js";
import type { PlanTool } from "./plan-tool.js";

const ISO_HEIGHT =
  "calc(100svh - var(--chrome-top, 0px) - var(--chrome-bottom, 0px) - var(--chrome-slip, 0px) - 7rem)";

const NO_FINDINGS: readonly BoardFinding[] = [];

export function HullPlanPanel({
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
  section,
  focusArcs = false,
}: {
  readonly section?: string;
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
  const { draft, content, view, month } = useDesignState();
  const { edit } = useDesignActions();
  const [localShowArcs, setLocalShowArcs] = useState(true);
  const [localFindingsView, setLocalFindingsView] = useFindingsView();
  const showArcs = givenShowArcs ?? localShowArcs;
  const setShowArcs = onShowArcs ?? setLocalShowArcs;
  const findingsView = givenFindingsView ?? localFindingsView;
  const setFindingsView = onFindingsView ?? setLocalFindingsView;
  const showArcsControl = onShowArcs === undefined && givenOverlays === undefined;
  const findingsControl = onFindingsView === undefined;
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
  const { tool, notice, onNudge, onSide } = editing;
  const { frame, form, facts, superstructure } = model;
  const shown = useMemo(
    () => model.findings.filter((f) => passesFilter(f.severity, findingsView.filter)),
    [model.findings, findingsView.filter],
  );
  const viewDef = SHIP_VIEW_DEFS[givenShipView ?? DEFAULT_VIEW];
  const drawing = viewDef.id;
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
  const panelClassName = "rounded-none border-0 bg-transparent";
  const panelBody = (
    <>
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
        <HullPlanTopView
          draft={draft}
          content={content}
          view={view}
          model={model}
          editing={editing}
          overlays={givenOverlays}
          showArcs={showArcs}
          focusArcs={focusArcs}
          armourHighlight={armourHighlight}
          starboard={starboard}
          anatomy={anatomy}
          shown={shown}
          findingsVisible={findingsView.visible}
        />
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
            section={section}
            className="mx-auto min-h-64"
            style={{ height: ISO_HEIGHT }}
          />
        </div>
      )}
      <HullPlanStatusBar draft={draft} model={model} />
    </>
  );
  if (givenShipView !== undefined) {
    return (
      <Panel.Root label="Hull plan" className={panelClassName}>
        <Panel.Body variant="flush">{panelBody}</Panel.Body>
      </Panel.Root>
    );
  }
  return (
    <Panel title="Hull plan" className={panelClassName}>
      {panelBody}
    </Panel>
  );
}
