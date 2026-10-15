import { act, renderHook } from "@testing-library/react";
import type { DraftEdit } from "@bluewave/ship-design";
import { buildWorkshopView } from "@bluewave/ship-design";
import { describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../content.js";
import { fittingPoint } from "./geometry.js";
import { IDLE_TOOL, type PlanTool } from "./plan-tool.js";
import { planModel } from "./planModel.js";
import { useHullPlanEditing } from "./useHullPlanEditing.js";

const content = loadDrawingBoardContent();
const ref = content.references.find((r) => r.id === "majestic_like")!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const model = planModel(ref.draft, content, view, ref.month);
const options = (edit: (e: DraftEdit) => void) => ({
  draft: ref.draft,
  content,
  month: ref.month,
  frame: model.frame,
  zones: model.zones,
  entryOf: model.entryOf,
  edit,
});

describe("useHullPlanEditing", () => {
  it("keeps the plan's own tool state when none is given", () => {
    const { result } = renderHook(() => useHullPlanEditing(options(() => {})));
    expect(result.current.tool).toEqual(IDLE_TOOL);
    act(() => result.current.setTool({ ...IDLE_TOOL, mode: "place" }));
    expect(result.current.tool.mode).toBe("place");
  });

  it("routes tool changes through the given handler when controlled", () => {
    const onTool = vi.fn<(next: PlanTool) => void>();
    const { result } = renderHook(() =>
      useHullPlanEditing({ ...options(() => {}), givenTool: IDLE_TOOL, onTool }),
    );
    act(() => result.current.setTool({ ...IDLE_TOOL, mode: "move" }));
    expect(onTool).toHaveBeenCalledWith({ ...IDLE_TOOL, mode: "move" });
  });

  it("clears a notice when the tool changes", () => {
    const { result } = renderHook(() => useHullPlanEditing(options(() => {})));
    act(() => result.current.setNotice("hello"));
    expect(result.current.notice).toBe("hello");
    act(() => result.current.setTool({ ...result.current.tool, mode: "place" }));
    expect(result.current.notice).toBeNull();
  });

  it("refuses to place with no component chosen", () => {
    const { result } = renderHook(() => useHullPlanEditing(options(() => {})));
    act(() => result.current.setTool({ ...IDLE_TOOL, mode: "place" }));
    act(() => result.current.onPlanClick(model.frame.x(300), 100));
    expect(result.current.notice).toMatch(/Choose a component/);
  });

  it("picks the fitting under a click in move mode", () => {
    const { result } = renderHook(() => useHullPlanEditing(options(() => {})));
    const index = ref.draft.placements.length - 1;
    const placed = ref.draft.placements[index]!;
    const point = fittingPoint(model.frame, placed.stationPermille, placed.side, index);
    act(() => result.current.setTool({ ...IDLE_TOOL, mode: "move" }));
    act(() => result.current.onPlanClick(point.x, point.y));
    expect(result.current.tool.instanceId).toBe(placed.instanceId);
    expect(result.current.notice).toMatch(/Picked/);
  });

  it("emits one set_side edit for the selected fitting", () => {
    const edit = vi.fn<(e: DraftEdit) => void>();
    const { result } = renderHook(() => useHullPlanEditing(options(edit)));
    const placed = ref.draft.placements[0]!;
    act(() =>
      result.current.setTool({ ...IDLE_TOOL, mode: "move", instanceId: placed.instanceId }),
    );
    act(() => result.current.onSide("PORT"));
    expect(edit).toHaveBeenCalledWith({
      kind: "set_side",
      instanceId: placed.instanceId,
      side: "PORT",
    });
  });

  it("refuses to auto-place with no component chosen", () => {
    const { result } = renderHook(() => useHullPlanEditing(options(() => {})));
    act(() => result.current.setTool({ ...IDLE_TOOL, mode: "place" }));
    act(() => result.current.onAutoPlace());
    expect(result.current.notice).toMatch(/Choose a component/);
  });

  it("exposes the pointer handlers the drawing's click layer needs", () => {
    const { result } = renderHook(() => useHullPlanEditing(options(() => {})));
    expect(Object.keys(result.current.planHandlers).sort()).toEqual([
      "onClick",
      "onPointerCancel",
      "onPointerDown",
      "onPointerMove",
      "onPointerUp",
    ]);
  });
});
