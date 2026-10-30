import { describe, expect, it } from "vite-plus/test";
import {
  classifyHotkeyTarget,
  fleetHotkeyAction,
  orderHotkeyIntent,
  stepDivisionSelection,
  type HotkeyEvent,
} from "./fleet-hotkeys.js";

function event(overrides: Partial<HotkeyEvent> = {}): HotkeyEvent {
  return {
    key: "]",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    target: "none",
    ...overrides,
  };
}

describe("fleetHotkeyAction", () => {
  it.each([
    ["[", "previous-division"],
    ["]", "next-division"],
    ["m", "focus-destination"],
    ["M", "focus-destination"],
    ["Enter", "submit-order"],
    ["Escape", "cancel-order"],
    ["r", "reserve-selected"],
    ["R", "reserve-selected"],
  ] as const)("maps %s to %s", (key, action) => {
    expect(fleetHotkeyAction(event({ key }))).toBe(action);
  });

  it("ignores unmapped keys", () => {
    expect(fleetHotkeyAction(event({ key: "x" }))).toBeNull();
  });

  it("ignores keys pressed with a command modifier", () => {
    expect(fleetHotkeyAction(event({ key: "r", ctrlKey: true }))).toBeNull();
    expect(fleetHotkeyAction(event({ key: "r", metaKey: true }))).toBeNull();
    expect(fleetHotkeyAction(event({ key: "r", altKey: true }))).toBeNull();
  });

  it("ignores keys another handler already consumed", () => {
    expect(fleetHotkeyAction(event({ key: "r", defaultPrevented: true }))).toBeNull();
  });

  it("ignores every key while typing or inside an overlay", () => {
    for (const target of ["text-entry", "overlay"] as const) {
      expect(fleetHotkeyAction(event({ key: "r", target }))).toBeNull();
      expect(fleetHotkeyAction(event({ key: "Enter", target }))).toBeNull();
    }
  });

  it("leaves Enter to a focused control but keeps the other keys", () => {
    expect(fleetHotkeyAction(event({ key: "Enter", target: "control" }))).toBeNull();
    expect(fleetHotkeyAction(event({ key: "]", target: "control" }))).toBe("next-division");
    expect(fleetHotkeyAction(event({ key: "Escape", target: "control" }))).toBe("cancel-order");
  });
});

describe("classifyHotkeyTarget", () => {
  function element(html: string): Element {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    return host.firstElementChild as Element;
  }

  it("treats text fields and editable regions as text entry", () => {
    expect(classifyHotkeyTarget(element('<input type="text" />'))).toBe("text-entry");
    expect(classifyHotkeyTarget(element("<textarea></textarea>"))).toBe("text-entry");
    expect(classifyHotkeyTarget(element('<div contenteditable="true"></div>'))).toBe("text-entry");
  });

  it("treats buttons, links and checkboxes as controls", () => {
    expect(classifyHotkeyTarget(element("<button>x</button>"))).toBe("control");
    expect(classifyHotkeyTarget(element('<a href="#x">x</a>'))).toBe("control");
    expect(classifyHotkeyTarget(element('<input type="checkbox" />'))).toBe("control");
    expect(classifyHotkeyTarget(element('<div role="radio"></div>'))).toBe("control");
  });

  it("treats anything inside a dialog or listbox as an overlay", () => {
    const inner = element('<div role="listbox"><button id="o">x</button></div>');
    expect(classifyHotkeyTarget(inner.querySelector("#o"))).toBe("overlay");
  });

  it("treats the page body and a missing target as none", () => {
    expect(classifyHotkeyTarget(document.body)).toBe("none");
    expect(classifyHotkeyTarget(null)).toBe("none");
  });
});

describe("stepDivisionSelection", () => {
  const ids = ["a", "b", "c"];

  it("steps forward and wraps", () => {
    expect(stepDivisionSelection(ids, "a", 1)).toBe("b");
    expect(stepDivisionSelection(ids, "c", 1)).toBe("a");
  });

  it("steps back and wraps", () => {
    expect(stepDivisionSelection(ids, "b", -1)).toBe("a");
    expect(stepDivisionSelection(ids, "a", -1)).toBe("c");
  });

  it("starts at the first or last division when none is selected", () => {
    expect(stepDivisionSelection(ids, null, 1)).toBe("a");
    expect(stepDivisionSelection(ids, null, -1)).toBe("c");
  });

  it("selects nothing when there are no divisions", () => {
    expect(stepDivisionSelection([], null, 1)).toBeNull();
  });
});

describe("orderHotkeyIntent", () => {
  const base = {
    busy: false,
    divisionSelected: true,
    destinationChosen: true,
    pendingCommandId: null,
  };

  it("submits a new order when none is pending", () => {
    expect(orderHotkeyIntent("submit-order", base)).toEqual({ kind: "submit" });
  });

  it("replaces the pending order when one exists", () => {
    expect(orderHotkeyIntent("submit-order", { ...base, pendingCommandId: "cmd_1" })).toEqual({
      kind: "replace",
      commandId: "cmd_1",
    });
  });

  it("cancels only a pending order", () => {
    expect(orderHotkeyIntent("cancel-order", base)).toBeNull();
    expect(orderHotkeyIntent("cancel-order", { ...base, pendingCommandId: "cmd_1" })).toEqual({
      kind: "cancel",
      commandId: "cmd_1",
    });
  });

  it("does nothing while a request is in flight", () => {
    expect(orderHotkeyIntent("submit-order", { ...base, busy: true })).toBeNull();
    expect(
      orderHotkeyIntent("cancel-order", { ...base, busy: true, pendingCommandId: "cmd_1" }),
    ).toBeNull();
  });

  it("does not submit without a division or a destination", () => {
    expect(orderHotkeyIntent("submit-order", { ...base, divisionSelected: false })).toBeNull();
    expect(orderHotkeyIntent("submit-order", { ...base, destinationChosen: false })).toBeNull();
  });
});
