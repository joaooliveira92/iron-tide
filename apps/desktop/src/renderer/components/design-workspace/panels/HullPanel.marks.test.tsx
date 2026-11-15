import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DesignWorkspaceFixture } from "../DesignWorkspaceFixture.js";
import { loadDrawingBoardContent } from "../content.js";
import { HullPanel } from "./HullPanel.js";
import { HullPlanPanel } from "./hull-plan/HullPlanPanel.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const other = content.hullForms.find((f) => f.id !== ref.draft.hull.hullFormId)!;

function mount() {
  render(
    <DesignWorkspaceFixture content={content} draft={ref.draft} month={ref.month}>
      <HullPanel />
      <HullPlanPanel shipView="iso" findings={[]} />
    </DesignWorkspaceFixture>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Hull form" }));
}

const optionFor = (id: string) => document.querySelector(`[role="option"][data-value="${id}"]`)!;
const marked = () => [...document.querySelectorAll(".an-part[data-changed]")];

describe("hull form hover marks the figure", () => {
  it("marks the parts the highlighted option would change, statically, and clears on close", () => {
    mount();
    expect(marked()).toHaveLength(0);
    fireEvent.pointerMove(optionFor(other.id));
    const parts = marked();
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((part) => part.getAttribute("data-changed") === "preview")).toBe(true);
    expect(parts.some((part) => part.getAttribute("data-kind") === "hull")).toBe(true);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Hull form" }), { key: "Escape" });
    expect(marked()).toHaveLength(0);
  });
});
