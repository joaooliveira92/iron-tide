import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const builds = vi.hoisted(() => ({ count: 0 }));

vi.mock("@bluewave/ship-design", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bluewave/ship-design")>();
  return {
    ...actual,
    buildWorkshopView: (...args: Parameters<typeof actual.buildWorkshopView>) => {
      builds.count += 1;
      return actual.buildWorkshopView(...args);
    },
  };
});

import { DesignWorkspaceFixture } from "../DesignWorkspaceFixture.js";
import { loadDrawingBoardContent } from "../content.js";
import { HullPanel } from "./HullPanel.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const other = content.hullForms.find((f) => f.id !== ref.draft.hull.hullFormId)!;

function mount() {
  render(
    <DesignWorkspaceFixture content={content} draft={ref.draft} month={ref.month}>
      <HullPanel />
    </DesignWorkspaceFixture>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Hull form" }));
}

const optionFor = (id: string) => document.querySelector(`[role="option"][data-value="${id}"]`)!;

describe("hull form hover preview", () => {
  it("shows toned deltas for the highlighted hull form and clears them on close", () => {
    mount();
    expect(screen.queryByTestId("delta-preview")).toBeNull();
    fireEvent.pointerMove(optionFor(other.id));
    const preview = screen.getByTestId("delta-preview");
    expect(preview.getAttribute("aria-label")).toBe("Effect of the highlighted hull form");
    expect(preview.querySelectorAll("li[data-tone]").length).toBeGreaterThan(0);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Hull form" }), { key: "Escape" });
    expect(screen.queryByTestId("delta-preview")).toBeNull();
  });

  it("builds the highlighted option once however often it is re-highlighted", () => {
    mount();
    const start = builds.count;
    fireEvent.pointerMove(optionFor(other.id));
    expect(builds.count - start).toBe(1);
    fireEvent.pointerMove(optionFor(ref.draft.hull.hullFormId));
    fireEvent.pointerMove(optionFor(other.id));
    fireEvent.pointerMove(optionFor(other.id));
    expect(builds.count - start).toBe(1);
  });

  it("builds nothing while no option is highlighted", () => {
    const start = builds.count;
    mount();
    expect(builds.count - start).toBe(1);
  });
});
