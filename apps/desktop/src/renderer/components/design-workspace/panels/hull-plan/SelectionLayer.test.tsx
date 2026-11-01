import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { machineryRooms } from "../../selection/facts.js";
import { createSelectionStore, entityKey } from "../../selection/store.js";
import { ShipSelectionProvider } from "../../selection/useShipSelection.js";
import { SelectionLayer } from "./SelectionLayer.js";
import { frame, hullForm as form, reference } from "./test-fixtures.js";

const zoneOf = (id: string) => form.zones.find((z) => z.id === id)!;

const setup = (warns = false) => {
  const store = createSelectionStore();
  const { container } = render(
    <ShipSelectionProvider store={store}>
      <svg>
        <SelectionLayer
          frame={frame}
          zones={form.zones}
          draft={reference.draft}
          warned={
            warns
              ? new Set([entityKey({ kind: "section", id: "central-machinery" })])
              : new Set<string>()
          }
        />
      </svg>
    </ShipSelectionProvider>,
  );
  return { store, container };
};

describe("SelectionLayer", () => {
  it("marks a selected section solid, with a warning glyph above it when the section warns", () => {
    const { store, container } = setup(true);
    act(() => store.select({ kind: "section", id: "central-machinery" }));
    const selected = container.querySelector("[data-testid='section-selected']")!;
    expect(selected.getAttribute("data-zone")).toBe("CENTRAL_MACHINERY");
    expect(container.querySelector("[data-testid='selection-warning']")).not.toBeNull();
  });

  it("has no warning glyph when the selected section is clean", () => {
    const { store, container } = setup(false);
    act(() => store.select({ kind: "section", id: "central-machinery" }));
    expect(container.querySelector("[data-testid='section-selected']")).not.toBeNull();
    expect(container.querySelector("[data-testid='selection-warning']")).toBeNull();
  });

  it("previews the section whose hover card is open, unless it is already selected", () => {
    const { store, container } = setup();
    act(() => store.setPreview("superstructure"));
    expect(
      container.querySelector("[data-testid='section-highlight']")!.getAttribute("data-zone"),
    ).toBe("SUPERSTRUCTURE");
    act(() => store.select({ kind: "section", id: "superstructure" }));
    expect(container.querySelector("[data-testid='section-highlight']")).toBeNull();
  });

  it("links sections and machinery rooms from a focused form", () => {
    const { store, container } = setup();
    act(() => store.setLinked([{ kind: "section", id: "forecastle" }]));
    expect(
      container.querySelector("[data-testid='section-linked']")!.getAttribute("data-zone"),
    ).toBe("FORECASTLE");
    act(() => store.select({ kind: "machinery-room", index: 0 }));
    const room = container.querySelector("[data-testid='room-selected']")!;
    expect(room.getAttribute("data-station")).toBe(
      String(machineryRooms(reference.draft)[0]!.stationPermille),
    );
  });

  it("does not double-draw a linked entity that is also selected", () => {
    const { store, container } = setup();
    act(() => store.select({ kind: "section", id: "forecastle" }));
    act(() => store.setLinked([{ kind: "section", id: "forecastle" }]));
    expect(container.querySelectorAll("[data-testid='section-linked']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-testid='section-selected']")).toHaveLength(1);
    expect(zoneOf("FORECASTLE")).toBeTruthy();
  });
});
