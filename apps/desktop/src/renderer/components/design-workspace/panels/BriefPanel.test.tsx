import { buildWorkshopView } from "@bluewave/ship-design";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../content.js";
import { BriefPanel } from "./BriefPanel.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const reference = content.references[0]!;
const env = content.environmentFor(reference.month);
const view = buildWorkshopView(reference.draft, env);

describe("BriefPanel accommodation", () => {
  it("shows the design's accommodation standard and edits it through the requirement", () => {
    const edit = vi.fn();
    const draft = {
      ...reference.draft,
      requirement: { ...reference.draft.requirement, accommodationStandard: "STANDARD" as const },
    };
    render(<BriefPanel draft={draft} view={view} edit={edit} ctx={env.ctx} />);

    const trigger = screen.getByRole("combobox", { name: "Accommodation" });
    expect(trigger.textContent).toContain("Standard");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: /Generous/ }));

    expect(edit).toHaveBeenCalledWith({
      kind: "set_requirement",
      patch: { accommodationStandard: "GENEROUS" },
    });
  });
});
