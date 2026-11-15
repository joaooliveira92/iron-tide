import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { armourMaterialOptions, buildWorkshopView } from "@bluewave/ship-design";
import { DesignWorkspaceFixture } from "../../../components/design-workspace/DesignWorkspaceFixture.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/index.js";
import { protectionModel } from "../protection-view.js";
import { ArmourSchemeSelector } from "./ArmourSchemeSelector.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);
const materials = armourMaterialOptions(env.ctx.balance.armour, ref.month, env.ctx.unlockedTechs);

function draw(year: number, schemeId?: "PROTECTED_CRUISER") {
  const draft = {
    ...ref.draft,
    armour: { ...ref.draft.armour, ...(schemeId ? { schemeId } : {}) },
  };
  const model = protectionModel(draft, view, materials, year);
  render(
    <DesignWorkspaceFixture content={content} draft={draft} view={view} month={ref.month}>
      <ArmourSchemeSelector model={model} edit={vi.fn()} />
    </DesignWorkspaceFixture>,
  );
}

describe("armour scheme hover preview", () => {
  it("shows toned deltas while a scheme is hovered or focused and clears them on leave", () => {
    draw(1880);
    expect(screen.queryByTestId("delta-preview")).toBeNull();
    const button = screen.getByRole("button", { name: /Protected cruiser/ });
    fireEvent.mouseEnter(button);
    const preview = screen.getByTestId("delta-preview");
    expect(preview.getAttribute("aria-label")).toBe("Effect of the highlighted scheme");
    expect(preview.querySelectorAll("li[data-tone]").length).toBeGreaterThan(0);
    fireEvent.mouseLeave(button);
    expect(screen.queryByTestId("delta-preview")).toBeNull();
    fireEvent.focus(button);
    expect(screen.getByTestId("delta-preview")).toBeTruthy();
    fireEvent.blur(button);
    expect(screen.queryByTestId("delta-preview")).toBeNull();
  });

  it("offers no preview for a locked scheme or for the applied one", () => {
    draw(1880, "PROTECTED_CRUISER");
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Belt and sloping deck/ }));
    expect(screen.queryByTestId("delta-preview")).toBeNull();
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Protected cruiser/ }));
    expect(screen.queryByTestId("delta-preview")).toBeNull();
  });

  it("renders without a design workspace and simply shows no preview", () => {
    const model = protectionModel(ref.draft, view, materials, 1880);
    render(<ArmourSchemeSelector model={model} edit={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Protected cruiser/ }));
    expect(screen.queryByTestId("delta-preview")).toBeNull();
  });
});
