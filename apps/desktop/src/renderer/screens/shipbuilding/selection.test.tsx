import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { findEntityControl, focusEntityControl, placeForEntity } from "./selection.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const reference = content.references[0]!;
const ctx = { draft: reference.draft, content };

describe("placeForEntity", () => {
  it("sends a fitting to the tab that lists and edits its category", () => {
    expect(placeForEntity({ kind: "fitting", instanceId: "gun_12pdr" }, ctx)).toEqual({
      section: "armament",
      tab: "secondary",
    });
    expect(placeForEntity({ kind: "fitting", instanceId: "mag_fwd" }, ctx)).toEqual({
      section: "protection",
      tab: "magazines",
    });
    expect(placeForEntity({ kind: "fitting", instanceId: "tubes" }, ctx)).toEqual({
      section: "armament",
      tab: "torpedoes",
    });
  });

  it("gives each entity kind a fixed home", () => {
    expect(placeForEntity({ kind: "ship" }, ctx)).toEqual({ section: "overview", tab: "summary" });
    expect(placeForEntity({ kind: "section", id: "central-machinery" }, ctx)).toEqual({
      section: "machinery",
      tab: "propulsion",
    });
    expect(placeForEntity({ kind: "section", id: "aft-magazine" }, ctx)).toEqual({
      section: "protection",
      tab: "magazines",
    });
    expect(placeForEntity({ kind: "section", id: "forecastle" }, ctx)).toEqual({
      section: "hull",
      tab: "dimensions",
    });
    expect(placeForEntity({ kind: "machinery-room", index: 0 }, ctx)).toEqual({
      section: "machinery",
      tab: "propulsion",
    });
  });

  it("maps every section to a real place, and a gone fitting to none", () => {
    for (const id of [
      "forecastle",
      "forward-magazine",
      "forward-service",
      "central-machinery",
      "superstructure",
      "aft-service",
      "aft-magazine",
      "quarterdeck",
    ] as const)
      expect(placeForEntity({ kind: "section", id }, ctx)).not.toBeNull();
    expect(placeForEntity({ kind: "fitting", instanceId: "nothing" }, ctx)).toBeNull();
  });
});

describe("findEntityControl and focusEntityControl", () => {
  const draw = () =>
    render(
      <div>
        <div data-ship-link={JSON.stringify([{ kind: "fitting", instanceId: "gun_12pdr" }])}>
          <input aria-label="Rounds per gun" />
        </div>
        <div data-ship-link={JSON.stringify([{ kind: "fitting", instanceId: "mag_fwd" }])}>
          <input aria-label="Station" />
        </div>
      </div>,
    );

  it("finds the control that edits the entity", () => {
    draw();
    const control = findEntityControl(document.body, { kind: "fitting", instanceId: "gun_12pdr" });
    expect(control?.querySelector("input")?.getAttribute("aria-label")).toBe("Rounds per gun");
  });

  it("focuses the entity's first field, and reports when there is no control", () => {
    draw();
    const root = document.body;
    expect(focusEntityControl(root, { kind: "fitting", instanceId: "mag_fwd" })).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Station" }));
    expect(focusEntityControl(root, { kind: "fitting", instanceId: "nope" })).toBe(false);
  });
});
