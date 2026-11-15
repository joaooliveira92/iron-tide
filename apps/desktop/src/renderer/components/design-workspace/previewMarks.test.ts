import { describe, expect, it, vi } from "vite-plus/test";
import { createPreviewMarks } from "./previewMarks.js";

describe("createPreviewMarks", () => {
  it("is empty and stable until something is published", () => {
    const marks = createPreviewMarks();
    expect(marks.get().size).toBe(0);
    expect(marks.get()).toBe(marks.get());
  });

  it("unions the kinds of every owner and drops one owner without touching another", () => {
    const marks = createPreviewMarks();
    const a = {};
    const b = {};
    marks.set(a, new Set(["hull"]));
    marks.set(b, new Set(["armour", "hull"]));
    expect([...marks.get()].toSorted()).toEqual(["armour", "hull"]);
    marks.clear(b);
    expect([...marks.get()]).toEqual(["hull"]);
    marks.clear(a);
    expect(marks.get().size).toBe(0);
  });

  it("notifies subscribers only when the union changes", () => {
    const marks = createPreviewMarks();
    const seen = vi.fn();
    const stop = marks.subscribe(seen);
    const owner = {};
    marks.set(owner, new Set(["hull"]));
    marks.set(owner, new Set(["hull"]));
    expect(seen).toHaveBeenCalledTimes(1);
    marks.clear(owner);
    expect(seen).toHaveBeenCalledTimes(2);
    marks.clear(owner);
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    marks.set(owner, new Set(["weapon"]));
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
