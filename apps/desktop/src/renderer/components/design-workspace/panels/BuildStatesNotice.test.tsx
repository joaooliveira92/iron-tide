import { buildWorkshopView, type ShipContext } from "@bluewave/ship-design";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../content.js";
import { DesignWorkspaceFixture } from "../DesignWorkspaceFixture.js";
import { BriefPanel } from "./BriefPanel.js";
import { HullPanel } from "./HullPanel.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const reference = content.references[0]!;
const env = content.environmentFor(reference.month, reference.draft.nationId);
const draftOf = (category: string) => ({
  ...reference.draft,
  requirement: { ...reference.draft.requirement, category },
});

const renderPanel = (
  draft: ReturnType<typeof draftOf>,
  panel: "brief" | "hull",
  ctx: ShipContext = env.ctx,
) =>
  render(
    <DesignWorkspaceFixture
      draft={draft}
      view={buildWorkshopView(draft, { ...env, ctx })}
      edit={vi.fn()}
      ctx={ctx}
    >
      {panel === "brief" ? <BriefPanel /> : <HullPanel />}
    </DesignWorkspaceFixture>,
  );

const withDockCeiling = (maximumNewConstructionMassKg: number): ShipContext => ({
  ...env.ctx,
  navalProfile: {
    ...env.ctx.navalProfile!,
    dock: { ...env.ctx.navalProfile!.dock, maximumNewConstructionMassKg },
  },
});

describe("locked ship classes in the brief", () => {
  it("lists locked types as disabled options that say what they need", () => {
    renderPanel(draftOf("DD"), "brief");
    fireEvent.click(screen.getByRole("combobox", { name: "Ship type" }));
    const bb = screen.getByRole("option", { name: /BB/ });
    expect(bb.getAttribute("aria-disabled")).toBe("true");
    expect(bb.textContent).toMatch(/locked/i);
  });

  it("states a locked class with its own label", () => {
    renderPanel(draftOf("BB"), "brief");
    const list = screen.getByRole("list", { name: "Why this design cannot be built" });
    expect(within(list).getAllByText("Class locked").length).toBeGreaterThan(0);
  });

  it("states a design that misses its class with a different label", () => {
    renderPanel(draftOf("B"), "brief");
    const list = screen.getByRole("list", { name: "Why this design cannot be built" });
    expect(within(list).queryByText("Class locked")).toBeNull();
    expect(within(list).getAllByText("Design does not match class").length).toBeGreaterThan(0);
  });
});

describe("domestic max build tonnage in the hull panel", () => {
  it("shows the dock's new-construction ceiling next to displacement", () => {
    renderPanel(draftOf("DD"), "hull");
    const ceiling = env.ctx.navalProfile!.dock.maximumNewConstructionMassKg;
    const line = screen.getByText(/Largest ship your docks can build/);
    expect(line.textContent).toMatch(/\d/);
    expect(line.getAttribute("data-max-build-kg")).toBe(String(ceiling));
  });

  it("flags a yard that is too small once the design outgrows the dock", () => {
    renderPanel(draftOf("DD"), "hull", withDockCeiling(100_000));
    const list = screen.getByRole("list", { name: "Why this design cannot be built" });
    expect(within(list).getByText("Yard too small")).toBeDefined();
  });

  it("does not flag the yard while the design fits", () => {
    renderPanel(draftOf("DD"), "hull");
    expect(screen.queryByText("Yard too small")).toBeNull();
  });

  it("shows no ceiling when no national profile is loaded", () => {
    const bare = content.environmentFor(reference.month);
    render(
      <DesignWorkspaceFixture
        draft={reference.draft}
        view={buildWorkshopView(reference.draft, bare)}
        ctx={bare.ctx}
      >
        <HullPanel />
      </DesignWorkspaceFixture>,
    );
    expect(screen.queryByText(/Largest ship your docks can build/)).toBeNull();
  });
});
