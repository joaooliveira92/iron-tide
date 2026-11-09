import { buildWorkshopView, UM_PER_INCH, UM_PER_KNOT } from "@bluewave/ship-design";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../content.js";
import { DesignWorkspaceFixture } from "../DesignWorkspaceFixture.js";
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
    render(
      <DesignWorkspaceFixture draft={draft} view={view} edit={edit} ctx={env.ctx}>
        <BriefPanel />
      </DesignWorkspaceFixture>,
    );

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

describe("BriefPanel requirements", () => {
  const renderBrief = (draft: typeof reference.draft, v: typeof view) =>
    render(
      <DesignWorkspaceFixture draft={draft} view={v} edit={vi.fn()} ctx={env.ctx}>
        <BriefPanel />
      </DesignWorkspaceFixture>,
    );
  const asB = {
    ...reference.draft,
    requirement: { ...reference.draft.requirement, category: "B" as const },
  };
  const listName = "Requirements of the chosen type";

  it("lists one row per requirement of the chosen type, generated from the view", () => {
    const bView = buildWorkshopView(asB, env);
    if (bView.requirements.status !== "CLASSIFIED") throw new Error("B is classified");
    renderBrief(asB, bView);
    const list = screen.getByRole("list", { name: listName });
    expect(within(list).getAllByRole("listitem")).toHaveLength(bView.requirements.checks.length);
    const rules = env.ctx.balance.classification!;
    expect(list.textContent).toContain(`Main belt at least ${rules.bBeltMinUm / UM_PER_INCH} in`);
    expect(list.textContent).toContain(`Speed below ${rules.bMaxSpeedUms / UM_PER_KNOT} kn`);
  });

  it("marks each row met or not met with the current value", () => {
    renderBrief(asB, buildWorkshopView(asB, env));
    const rows = within(screen.getByRole("list", { name: listName })).getAllByRole("listitem");
    for (const row of rows) expect(row.textContent).toMatch(/Met|Not met/);
    expect(rows.some((r) => /now \d/.test(r.textContent ?? ""))).toBe(true);
    expect(rows.some((r) => r.textContent?.includes("Not met"))).toBe(true);
  });

  it("flips rows from not met to met when the view changes", () => {
    const before = buildWorkshopView(asB, env);
    const after = {
      ...before,
      requirements:
        before.requirements.status === "CLASSIFIED"
          ? {
              status: "CLASSIFIED" as const,
              checks: before.requirements.checks.map((c) => ({ ...c, met: true })),
            }
          : before.requirements,
    };
    const { rerender } = renderBrief(asB, before);
    expect(screen.getAllByText("Not met").length).toBeGreaterThan(0);
    rerender(
      <DesignWorkspaceFixture draft={asB} view={after} edit={vi.fn()} ctx={env.ctx}>
        <BriefPanel />
      </DesignWorkspaceFixture>,
    );
    expect(screen.queryAllByText("Not met")).toHaveLength(0);
  });

  it("says a type without a classifier has no rules instead of showing blanks", () => {
    renderBrief(asB, { ...view, requirements: { status: "UNCLASSIFIED" } });
    expect(screen.getByText(/no classification rules/i)).toBeTruthy();
    expect(screen.queryByRole("list", { name: listName })).toBeNull();
  });
});
