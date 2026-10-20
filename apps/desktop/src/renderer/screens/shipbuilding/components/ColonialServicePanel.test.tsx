import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../../components/design-workspace/index.js";
import { colonialServiceModel } from "../colonial-service-view.js";
import { ColonialServicePanel } from "./ColonialServicePanel.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);

describe("ColonialServicePanel", () => {
  it("fits and unfits through one edit each", () => {
    const edit = vi.fn();
    const { rerender } = render(
      <ColonialServicePanel
        model={colonialServiceModel(buildWorkshopView(ref.draft, env))}
        edit={edit}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "Fit for colonial service" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(box);
    expect(edit).toHaveBeenLastCalledWith({ kind: "set_colonial_service", fitted: true });
    const fitted = { ...ref.draft, colonialServiceFitted: true };
    rerender(
      <ColonialServicePanel
        model={colonialServiceModel(buildWorkshopView(fitted, env))}
        edit={edit}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Fit for colonial service" }));
    expect(edit).toHaveBeenLastCalledWith({ kind: "set_colonial_service", fitted: false });
  });

  it("states 'not configured' in text for a fitted design with the dormant ruleset", () => {
    const fitted = { ...ref.draft, colonialServiceFitted: true };
    render(
      <ColonialServicePanel
        model={colonialServiceModel(buildWorkshopView(fitted, env))}
        edit={vi.fn()}
      />,
    );
    expect(screen.getByText(/not configured/i)).toBeTruthy();
  });
});
