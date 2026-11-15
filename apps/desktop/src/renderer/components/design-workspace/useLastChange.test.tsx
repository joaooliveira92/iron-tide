import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { DraftEdit } from "@bluewave/ship-design";
import { useDesignSession } from "./useDesignSession.js";

function morePower(kw: number): DraftEdit {
  return { kind: "set_machinery", patch: { installedKw: kw } };
}

function firstEdit() {
  const hook = renderHook(() => useDesignSession(null));
  const kw = hook.result.current.state.draft.machinery.installedKw;
  return { ...hook, kw };
}

describe("last change after a committed edit", () => {
  it("is empty before any edit", () => {
    const { result } = firstEdit();
    expect(result.current.lastChange).toBeNull();
  });

  it("names the edit and carries the aspect and finding deltas between the two views", () => {
    const { result, kw } = firstEdit();
    const before = result.current.state.view;
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.3))));
    const change = result.current.lastChange;
    expect(change?.kind).toBe("edit");
    expect(change?.label).toMatch(/Installed power from .* to /);
    expect(change?.feedback.hashBefore).toBe(before.compiled.hash);
    expect(change?.feedback.hashAfter).toBe(result.current.state.view.compiled.hash);
    const speed = change?.feedback.aspects.find((a) => a.aspect === "speed");
    expect(speed?.direction).not.toBe("flat");
    expect(speed?.tone).toBe(speed?.direction === "up" ? "better" : "worse");
    expect(speed?.section).toBe("machinery");
  });

  it("is replaced by the next edit", () => {
    const { result, kw } = firstEdit();
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.3))));
    const first = result.current.lastChange;
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.6))));
    expect(result.current.lastChange).not.toBe(first);
    expect(result.current.lastChange?.feedback.hashBefore).toBe(first?.feedback.hashAfter);
  });

  it("shows the reversal on undo and the repeat on redo", () => {
    const { result, kw } = firstEdit();
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.3))));
    const made = result.current.lastChange!;
    act(() => result.current.actions.undo());
    const undone = result.current.lastChange!;
    expect(undone.kind).toBe("undo");
    expect(undone.label).toBe(`Undid: ${made.label}`);
    expect(undone.feedback.hashBefore).toBe(made.feedback.hashAfter);
    expect(undone.feedback.hashAfter).toBe(made.feedback.hashBefore);
    const speedMade = made.feedback.aspects.find((a) => a.aspect === "speed")!;
    const speedUndone = undone.feedback.aspects.find((a) => a.aspect === "speed")!;
    expect(speedUndone.direction).toBe(speedMade.direction === "up" ? "down" : "up");
    expect(speedUndone.tone).toBe(speedMade.tone === "better" ? "worse" : "better");
    act(() => result.current.actions.redo());
    const redone = result.current.lastChange!;
    expect(redone.kind).toBe("redo");
    expect(redone.label).toBe(`Redid: ${made.label}`);
    expect(redone.feedback.hashAfter).toBe(made.feedback.hashAfter);
  });

  it("clears on loading another design and on request", () => {
    const { result, kw } = firstEdit();
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.3))));
    expect(result.current.lastChange).not.toBeNull();
    act(() => result.current.clearLastChange());
    expect(result.current.lastChange).toBeNull();
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.5))));
    const other = result.current.state.content.references.find(
      (r) => r.id !== result.current.state.preset.id,
    )!;
    act(() => result.current.loadPreset(other.id));
    expect(result.current.lastChange).toBeNull();
  });

  it("does not compile again while the strip is read", () => {
    const { result, rerender, kw } = firstEdit();
    act(() => result.current.actions.edit(morePower(Math.round(kw * 1.3))));
    const view = result.current.state.view;
    rerender();
    expect(result.current.state.view).toBe(view);
    expect(result.current.lastChange?.feedback.hashAfter).toBe(view.compiled.hash);
  });
});
