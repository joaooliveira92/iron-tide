import type { DesignDraft, MountSide, PartCatalogueEntry } from "@bluewave/ship-design";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { PlanToolOptions } from "./PlanToolbar.js";
import { IDLE_TOOL } from "./plan-tool.js";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const gunEntry: PartCatalogueEntry = {
  id: "gun_a",
  displayName: "Gun A",
  category: "MAIN_GUN",
  introduction: { fromMonth: "1880-01", obsoleteMonth: null },
  requires: [],
  tags: [],
  fcClass: null,
  parameters: {},
  entryUnits: null,
  rounds: null,
};
const pumpEntry: PartCatalogueEntry = {
  id: "pump",
  displayName: "Pump",
  category: "ACCOMMODATION",
  introduction: { fromMonth: "1880-01", obsoleteMonth: null },
  requires: [],
  tags: [],
  fcClass: null,
  parameters: {},
  entryUnits: null,
  rounds: null,
};
const draft = {
  placements: [
    {
      instanceId: "gun_1",
      componentId: "gun_a",
      zoneId: "FORECASTLE",
      stationPermille: 200,
      side: "CENTRE",
    },
  ],
} as unknown as DesignDraft;
const entryOf = (id: string) => (id === "gun_a" ? gunEntry : id === "pump" ? pumpEntry : undefined);

describe("PlanToolOptions", () => {
  const base = {
    draft,
    entryOf,
    onNudge: vi.fn<(d: number) => void>(),
    onSide: vi.fn<(s: MountSide) => void>(),
    notice: null,
  };

  it("explains the tool when idle, with no actions and no notice", () => {
    render(<PlanToolOptions {...base} tool={IDLE_TOOL} />);
    const options = screen.getByRole("group", { name: "Plan tool options" });
    expect(within(options).queryByRole("button", { name: /permille/ })).toBeNull();
    expect(within(options).getByRole("status").textContent).toMatch(/Right-click the plan/);
  });

  it("offers the selected fitting nudge buttons and a side picker for mounts", () => {
    const onNudge = vi.fn<(d: number) => void>();
    render(
      <PlanToolOptions
        {...base}
        onNudge={onNudge}
        tool={{ ...IDLE_TOOL, mode: "move", instanceId: "gun_1" }}
      />,
    );
    const bow = screen.getByRole("button", { name: /Move 10 permille toward the bow/ });
    fireEvent.click(bow);
    expect(onNudge).toHaveBeenCalledWith(-10);
    expect(screen.getByLabelText("Side of the selected fitting")).toBeTruthy();
  });

  it("shows the raised notice instead of the standing hint", () => {
    render(
      <PlanToolOptions
        {...base}
        notice="Placed Gun A at 300‰."
        tool={{ ...IDLE_TOOL, mode: "place" }}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("Placed Gun A at 300‰.");
  });

  it("names the active tool in the banner and offers Done only while a tool is on", () => {
    const onDone = vi.fn<() => void>();
    const { rerender } = render(<PlanToolOptions {...base} tool={IDLE_TOOL} onDone={onDone} />);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    rerender(<PlanToolOptions {...base} tool={{ ...IDLE_TOOL, mode: "place" }} onDone={onDone} />);
    const options = screen.getByRole("group", { name: "Plan tool options" });
    expect(options.textContent).toContain("Placing");
    expect(within(options).getByRole("status").textContent).toMatch(
      /Right-click the plan, then Place/,
    );
    fireEvent.click(within(options).getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledOnce();
    rerender(<PlanToolOptions {...base} tool={{ ...IDLE_TOOL, mode: "move" }} onDone={onDone} />);
    expect(screen.getByRole("group", { name: "Plan tool options" }).textContent).toContain(
      "Moving",
    );
  });
});
