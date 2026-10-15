import { useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type {
  DesignDraft,
  MountSide,
  PartCatalogueEntry,
  PlacementSpec,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import type { Edit } from "../types.js";
import type { PlanFrame } from "./geometry.js";
import { IDLE_TOOL, type PlanTool } from "./plan-tool.js";
import {
  autoPlace,
  clientToPlan,
  fittingAt,
  moveEdit,
  nudgeEdit,
  placeEdit,
  planTarget,
  type PlanEdit,
  type ZoneSpan,
} from "./placement-tools.js";

/**
 * The stateful half of the hull plan: which tool is active, the transient notice, and the click/drag session on
 * the drawing. Every action produces the same undoable `DraftEdit` as the Arrangement panel, through
 * `placement-tools`. Kept apart from `HullPlanPanel` so the panel stays a composition of drawing and controls.
 */
export interface UseHullPlanEditingOptions {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly month: string;
  readonly frame: PlanFrame;
  readonly zones: readonly ZoneSpan[];
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  readonly edit: Edit;
  /** The plan tool, switched from the board toolbar; the plan keeps its own only when shown on its own. */
  readonly givenTool?: PlanTool;
  readonly onTool?: (next: PlanTool) => void;
}

/** Pointer handlers for the invisible click layer over the plan; spread them onto its `<rect>`. */
export interface PlanPointerHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<SVGRectElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<SVGRectElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<SVGRectElement>) => void;
  readonly onPointerCancel: () => void;
  readonly onClick: (e: ReactMouseEvent<SVGRectElement>) => void;
}

export interface HullPlanEditing {
  readonly tool: PlanTool;
  readonly setTool: (next: PlanTool) => void;
  readonly notice: string | null;
  /** Raise a notice belonging to the tool state it was raised under; any tool change clears it. */
  readonly setNotice: (text: string, under?: PlanTool) => void;
  readonly selected: PlacementSpec | undefined;
  /** The in-flight drag position, drawn as a ghost; null when not dragging. */
  readonly ghost: { readonly x: number; readonly y: number } | null;
  readonly onPlanClick: (svgX: number, svgY: number) => void;
  readonly planHandlers: PlanPointerHandlers;
  readonly onNudge: (deltaPermille: number) => void;
  readonly onAutoPlace: () => void;
  readonly onSide: (side: MountSide) => void;
}

export function useHullPlanEditing({
  draft,
  content,
  month,
  frame,
  zones,
  entryOf,
  edit,
  givenTool,
  onTool,
}: UseHullPlanEditingOptions): HullPlanEditing {
  const [ownTool, setOwnTool] = useState<PlanTool>(IDLE_TOOL);
  const tool = givenTool ?? ownTool;
  const setTool = onTool ?? setOwnTool;
  // A notice belongs to the tool state it was raised under: any tool change (here or in the toolbar) clears it.
  const [raised, setRaised] = useState<{ readonly tool: PlanTool; readonly text: string } | null>(
    null,
  );
  const notice = raised?.tool === tool ? raised.text : null;
  const setNotice = (text: string, under: PlanTool = tool) => setRaised({ tool: under, text });
  const selected = draft.placements.find((x) => x.instanceId === tool.instanceId);

  const run = (r: PlanEdit, done: string, under: PlanTool = tool) => {
    if (r.ok) {
      edit(r.edit);
      setNotice(done, under);
    } else setNotice(r.reason, under);
  };
  const whereOf = (t: ReturnType<typeof planTarget>) =>
    `${t.stationPermille}‰${t.side === "CENTRE" ? "" : t.side === "PORT" ? ", port" : ", starboard"}`;
  const moveTo = (p: PlacementSpec, svgX: number, svgY: number, under: PlanTool = tool) => {
    const target = planTarget(frame, zones, svgX, svgY);
    run(
      moveEdit(p, entryOf(p.componentId), target),
      `Moved ${p.instanceId} to ${whereOf(target)}.`,
      under,
    );
  };
  /** Makes `instanceId` the fitting to move; returns the new tool state so a notice can belong to it. */
  const pick = (instanceId: string): PlanTool => {
    if (instanceId === tool.instanceId) return tool;
    const next = { ...tool, instanceId };
    setTool(next);
    return next;
  };
  const onPlanClick = (svgX: number, svgY: number) => {
    if (tool.mode === "place") {
      const target = planTarget(frame, zones, svgX, svgY);
      const entry = entryOf(tool.componentId);
      if (!entry) setNotice("Choose a component to place first.");
      else
        run(placeEdit(entry, target, draft), `Placed ${entry.displayName} at ${whereOf(target)}.`);
    } else if (tool.mode === "move") {
      // A click on a fitting picks it; a click elsewhere moves the picked one there.
      const hit = fittingAt(frame, draft, svgX, svgY);
      if (hit !== null && hit !== tool.instanceId)
        setNotice(
          `Picked ${hit}. Click where it should go, drag it, or use the buttons.`,
          pick(hit),
        );
      else if (!selected) setNotice("Choose a fitting to move first, or click one on the plan.");
      else moveTo(selected, svgX, svgY);
    }
  };

  // Drag to move (Move mode): press on a fitting, drag, release. The same moveEdit as the buttons; one undoable edit.
  const drag = useRef<{ readonly id: string; readonly x: number; readonly y: number } | null>(null);
  const [ghost, setGhost] = useState<{ readonly x: number; readonly y: number } | null>(null);
  const suppressClick = useRef(false);
  const planPointFromEvent = (e: {
    readonly currentTarget: SVGRectElement;
    readonly clientX: number;
    readonly clientY: number;
  }) =>
    clientToPlan(
      e.currentTarget.ownerSVGElement?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      },
      e.clientX,
      e.clientY,
    );
  const planHandlers: PlanPointerHandlers = {
    onPointerDown: (e) => {
      if (tool.mode !== "move") return;
      const point = planPointFromEvent(e);
      const hit = point && fittingAt(frame, draft, point.x, point.y);
      if (!point || !hit) return;
      drag.current = { id: hit, x: point.x, y: point.y };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      const point = d && planPointFromEvent(e);
      if (!d || !point) return;
      // A few units of travel before it counts as a drag, so a shaky click stays a click.
      if (ghost !== null || Math.hypot(point.x - d.x, point.y - d.y) > 4) setGhost(point);
    },
    onPointerUp: (e) => {
      const d = drag.current;
      drag.current = null;
      const point = planPointFromEvent(e);
      if (d && ghost !== null && point) {
        const p = draft.placements.find((x) => x.instanceId === d.id);
        if (p) moveTo(p, point.x, point.y, pick(d.id));
        suppressClick.current = true; // the click that follows this release is the drop, not a new click
      }
      setGhost(null);
    },
    onPointerCancel: () => {
      drag.current = null;
      setGhost(null);
    },
    onClick: (e) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      const point = planPointFromEvent(e);
      if (point) onPlanClick(point.x, point.y);
    },
  };

  const onNudge = (delta: number) => {
    if (selected)
      run(
        nudgeEdit(selected, entryOf(selected.componentId), zones, delta),
        `Moved ${selected.instanceId} ${Math.abs(delta)}‰ ${delta < 0 ? "toward the bow" : "toward the stern"}.`,
      );
  };
  const onAutoPlace = () => {
    const entry = entryOf(tool.componentId);
    if (!entry) return setNotice("Choose a component to place first.");
    const r = autoPlace(entry, draft, zones, content.environmentFor(month).ctx);
    run(
      r,
      `Placed ${entry.displayName} at ${r.ok ? r.stationPermille : "?"}‰, where the ship stays most level.`,
    );
  };
  const onSide = (side: MountSide) => {
    if (selected) {
      edit({ kind: "set_side", instanceId: selected.instanceId, side });
      setNotice(
        `Set ${selected.instanceId} to ${side === "CENTRE" ? "the centreline" : side === "PORT" ? "port" : "starboard"}.`,
      );
    }
  };

  return {
    tool,
    setTool,
    notice,
    setNotice,
    selected,
    ghost,
    onPlanClick,
    planHandlers,
    onNudge,
    onAutoPlace,
    onSide,
  };
}
