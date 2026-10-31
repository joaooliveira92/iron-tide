import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildWorkshopView, COMPONENT_CATEGORIES } from "@bluewave/ship-design";
import { Checkbox } from "../../components/ui/checkbox.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";
import { componentCategoryMeta } from "../../components/design-workspace/componentCategory.js";
import {
  componentFacts,
  componentsByCategory,
} from "../../components/design-workspace/componentFacts.js";
import { loadDrawingBoardContent } from "../../components/design-workspace/content.js";
import { exportDesign } from "../../components/design-workspace/designFile.js";
import { RequirementChip } from "../../components/design-workspace/RequirementChip.js";
import { openSection } from "./test-helpers.js";

afterEach(cleanup);
const content = loadDrawingBoardContent();
const ref = content.references[0]!;

describe("requirement chip", () => {
  it("shows an icon-only brief chip that opens every requirement in a popover", async () => {
    render(<RequirementChip requirement={ref.draft.requirement} />);
    const chip = screen.getByRole("button", { name: /^Design requirement: .* kn · .* nm$/ });
    expect(chip.querySelector("svg")).not.toBeNull();
    expect(chip.textContent).toBe("");
    fireEvent.click(chip);
    const dialog = await screen.findByText("Design requirement", { selector: "div" });
    const body = dialog.parentElement!.textContent!;
    for (const label of ["Top speed", "Cruising speed", "Range", "Crew quality", "Protection goal"])
      expect(body).toContain(label);
  });
});

describe("componentFacts", () => {
  const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
  const placed = ref.draft.placements[0]!;
  const entry = content.catalogue.find((e) => e.id === placed.componentId)!;

  it("reports the compiler's own weight and cost for a placed fitting", () => {
    const summary = view.compiled.components.find((c) => c.instanceId === placed.instanceId)!;
    const f = componentFacts(entry, summary);
    expect(f.name).toBe(entry.displayName);
    expect(f.placed).toEqual({
      weightT: summary.weightKg / 1000,
      costGbp: summary.costMicro / 1_000_000,
    });
  });
  it("has no weight or cost for a catalogue entry that is not placed", () => {
    expect(componentFacts(entry, undefined).placed).toBeNull();
  });
  it("groups the catalogue by category without losing or duplicating a component", () => {
    const groups = componentsByCategory(content.catalogue);
    expect(groups.flatMap((g) => g.items.map((i) => i.id)).sort()).toEqual(
      content.catalogue.map((c) => c.id).sort(),
    );
    expect(new Set(groups.map((g) => g.category)).size).toBe(groups.length);
  });
});

describe("componentCategoryMeta", () => {
  it("gives every category an icon and a description, and falls back for an unknown one", () => {
    for (const category of COMPONENT_CATEGORIES) {
      const meta = componentCategoryMeta(category);
      expect(meta.icon).toBeTruthy();
      expect(meta.description.length).toBeGreaterThan(0);
    }
    const fallback = componentCategoryMeta("AUXILIARY");
    expect(fallback.description).toBe("Ship component.");
  });
});

describe("design file chip", () => {
  it("shows the opened file as an attachment, and a bad file as an error chip", async () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /More design actions/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Import or export design/ }));
    const region = () => screen.getByRole("region", { name: "Design file" });
    const input = screen.getByLabelText("Design file", { selector: "input" }) as HTMLInputElement;
    const good = exportDesign(
      ref.draft,
      content.components,
      buildWorkshopView(ref.draft, content.environmentFor(ref.month)).compiled,
    );
    fireEvent.change(input, {
      target: { files: [new File([good], "my-ship.bwdesign", { type: "application/json" })] },
    });
    await waitFor(() =>
      expect(within(region()).getByLabelText("Last design file").textContent).toMatch(
        /my-ship\.bwdesign.*Opened/,
      ),
    );
    fireEvent.change(input, { target: { files: [new File(["nonsense"], "bad.bwdesign")] } });
    await waitFor(() => {
      const chip = within(region()).getByLabelText("Last design file");
      expect(chip.textContent).toMatch(/bad\.bwdesign.*Could not be opened/);
      expect(chip.getAttribute("data-state")).toBe("error");
    });
    expect(within(region()).getByRole("status").textContent).toMatch(/Cannot open design/);
  });
});

describe("Checkbox", () => {
  it("toggles and exposes its state to assistive technology", () => {
    render(<Checkbox aria-label="Show it" />);
    const box = screen.getByRole("checkbox", { name: "Show it" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
  });
});

describe("revision tier badge", () => {
  it("labels the tier with a badge", async () => {
    const project = {
      projectId: "p",
      className: "Ship",
      status: "ACTIVE",
      totalWork: 20,
      completedWork: 4,
    };
    render(<ShipbuildingWorkspace projects={[project]} />);
    openSection("Machinery");
    const input = screen.getByLabelText(/^Installed power/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
    fireEvent.blur(input);
    openSection("Review", "Finish");
    const preview = screen.getByRole("region", { name: "Revision preview" });
    const status = await within(preview).findByRole("status");
    expect(within(status).getByText(/^(Redesign|Revision)$/)).toBeTruthy();
    expect(within(preview).getByLabelText("Selected ship").textContent).toMatch(/authored design/);
  });
});
