import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { overlaysOf } from "../../../components/design-workspace/panels/hull-plan/ship-view.js";
import { ViewToolbar } from "./ViewToolbar.js";

afterEach(cleanup);

describe("ViewToolbar", () => {
  it("keeps Layers outside the segmented view group so a narrow toolbar can wrap it", () => {
    render(
      <ViewToolbar
        view="top"
        onView={() => {}}
        overlays={overlaysOf("top")}
        onToggleOverlay={() => {}}
      />,
    );
    const views = screen.getByRole("group", { name: "Ship view" });
    expect(within(views).getByRole("button", { name: "Top" })).toBeTruthy();
    const layers = screen.getByRole("button", { name: /Layers/ });
    expect(views.contains(layers)).toBe(false);
    expect(layers.getAttribute("title")).toBe("Show or hide drawing layers");
  });
});
