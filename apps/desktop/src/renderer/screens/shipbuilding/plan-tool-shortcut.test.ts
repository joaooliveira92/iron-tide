import { describe, expect, it } from "vite-plus/test";
import { IDLE_TOOL, type PlanTool } from "../../components/design-workspace/index.js";
import { planToolShortcut } from "./plan-tool-shortcut.js";

const key = (k: string, extra: Partial<KeyboardEvent> = {}, target: EventTarget | null = null) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  target,
  ...extra,
});

describe("planToolShortcut", () => {
  it("turns Place and Move on with P and M", () => {
    expect(planToolShortcut(key("p"), IDLE_TOOL)?.mode).toBe("place");
    expect(planToolShortcut(key("M"), IDLE_TOOL)?.mode).toBe("move");
  });

  it("turns the active tool off again, keeping its choices", () => {
    const tool: PlanTool = { mode: "place", componentId: "gun", instanceId: "" };
    expect(planToolShortcut(key("p"), tool)).toEqual({ ...tool, mode: "off" });
    expect(planToolShortcut(key("m"), tool)?.mode).toBe("move");
  });

  it("ignores other keys and modified keys", () => {
    expect(planToolShortcut(key("x"), IDLE_TOOL)).toBeNull();
    expect(planToolShortcut(key("p", { metaKey: true }), IDLE_TOOL)).toBeNull();
    expect(planToolShortcut(key("p", { ctrlKey: true }), IDLE_TOOL)).toBeNull();
    expect(planToolShortcut(key("p", { altKey: true }), IDLE_TOOL)).toBeNull();
  });

  it("never fires while typing in a field", () => {
    for (const tag of ["input", "textarea", "select"])
      expect(planToolShortcut(key("p", {}, document.createElement(tag)), IDLE_TOOL)).toBeNull();
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(planToolShortcut(key("p", {}, editable), IDLE_TOOL)).toBeNull();
  });
});
