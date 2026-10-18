import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { buildWorkshopView, armourMaterialOptions } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../../components/design-workspace/index.js";
import { protectionModel } from "../protection-view.js";
import { ArmourSchemeSelector } from "./ArmourSchemeSelector.js";

const content = loadDrawingBoardContent();
const ref = [...content.references].sort(
  (a, b) => b.draft.armour.regions.length - a.draft.armour.regions.length,
)[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);
const materials = armourMaterialOptions(env.ctx.balance.armour, ref.month, env.ctx.unlockedTechs);

function draw(year: number, schemeId?: "PROTECTED_CRUISER") {
  const draft = {
    ...ref.draft,
    armour: { ...ref.draft.armour, ...(schemeId ? { schemeId } : {}) },
  };
  const model = protectionModel(draft, view, materials, year);
  const edit = vi.fn();
  render(<ArmourSchemeSelector model={model} edit={edit} />);
  return edit;
}

describe("ArmourSchemeSelector", () => {
  it("shows Custom, and the later schemes locked with their unlock year, in 1880", () => {
    draw(1880);
    expect(screen.getByText("Custom")).toBeTruthy();
    const locked = screen.getByRole("button", { name: /Belt and sloping deck/ });
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    expect(locked.textContent).toMatch(/Unlocks in 1905/);
    expect(
      (screen.getByRole("button", { name: /Protected cruiser/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  it("applying a picked scheme sends one set_armour_scheme edit", () => {
    const edit = draw(1880);
    fireEvent.click(screen.getByRole("button", { name: /Protected cruiser/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Protected cruiser" }));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit.mock.calls[0]![0]).toMatchObject({
      kind: "set_armour_scheme",
      schemeId: "PROTECTED_CRUISER",
    });
  });
  it("names the active scheme and offers nothing to re-apply", () => {
    draw(1880, "PROTECTED_CRUISER");
    expect(screen.getAllByText("Protected cruiser").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Applied" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
