import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { armourMaterialOptions, buildWorkshopView } from "@bluewave/ship-design";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DesignWorkspaceFixture } from "../../../components/design-workspace/DesignWorkspaceFixture.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { HullPlanPanel } from "../../../components/design-workspace/panels/hull-plan/HullPlanPanel.js";
import { createPresentationFormat } from "../../../lib/presentation-format/profile.js";
import { machineryModel } from "../machinery-view.js";
import { protectionModel } from "../protection-view.js";
import { ArmourSchemeSelector } from "./ArmourSchemeSelector.js";
import { MachineryEditor } from "./MachineryEditor.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);
const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const marked = () =>
  [...document.querySelectorAll(".an-part[data-changed]")].map((part) => ({
    kind: part.getAttribute("data-kind"),
    changed: part.getAttribute("data-changed"),
  }));

describe("armour scheme hover marks the figure", () => {
  it("marks the changed parts while a scheme is focused and clears them on blur", () => {
    const materials = armourMaterialOptions(
      env.ctx.balance.armour,
      ref.month,
      env.ctx.unlockedTechs,
    );
    const model = protectionModel(ref.draft, view, materials, 1880);
    render(
      <DesignWorkspaceFixture content={content} draft={ref.draft} view={view} month={ref.month}>
        <ArmourSchemeSelector model={model} edit={vi.fn()} />
        <HullPlanPanel shipView="iso" findings={[]} />
      </DesignWorkspaceFixture>,
    );
    expect(marked()).toEqual([]);
    const button = screen.getByRole("button", { name: /Protected cruiser/ });
    fireEvent.focus(button);
    expect(marked().length).toBeGreaterThan(0);
    expect(marked().every((part) => part.changed === "preview")).toBe(true);
    fireEvent.blur(button);
    expect(marked()).toEqual([]);
  });
});

describe("machinery plant hover marks the figure", () => {
  it("marks the parts an alternative plant would change and clears on close", () => {
    const model = machineryModel(ref.draft, view, env, format);
    const other = model.inputs.plantOptions.find(
      (p) => p.id !== ref.draft.machinery.plantId && !p.disabled,
    )!;
    render(
      <DesignWorkspaceFixture content={content} draft={ref.draft} view={view} month={ref.month}>
        <MachineryEditor model={model} edit={vi.fn()} />
        <HullPlanPanel shipView="iso" findings={[]} />
      </DesignWorkspaceFixture>,
    );
    const select = screen.getByRole("combobox", { name: "Propulsion plant" });
    fireEvent.click(select);
    expect(marked()).toEqual([]);
    fireEvent.pointerMove(document.querySelector(`[role="option"][data-value="${other.id}"]`)!);
    expect(marked().length).toBeGreaterThan(0);
    expect(marked().every((part) => part.changed === "preview")).toBe(true);
    fireEvent.keyDown(select, { key: "Escape" });
    expect(marked()).toEqual([]);
  });
});
