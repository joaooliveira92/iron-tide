import { useState } from "react";
import type { ComponentCategory, DesignDraft, PartCatalogueEntry } from "@bluewave/ship-design";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { PlanContextMenu } from "./PlanContextMenu.js";
import { IDLE_TOOL, type PlanTool } from "./plan-tool.js";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const entry = (
  id: string,
  displayName: string,
  category: ComponentCategory,
): PartCatalogueEntry => ({
  id,
  displayName,
  category,
  introduction: { fromMonth: "1880-01", obsoleteMonth: null },
  requires: [],
  tags: [],
  fcClass: null,
  parameters: {},
  entryUnits: null,
  rounds: null,
});
const gunEntry = entry("gun_a", "Gun A", "MAIN_GUN");
const pumpEntry = entry("pump", "Pump", "DAMAGE_CONTROL");
const draft: Pick<DesignDraft, "placements"> = {
  placements: [
    {
      instanceId: "gun_1",
      componentId: "gun_a",
      zoneId: "FORECASTLE",
      stationPermille: 200,
      side: "CENTRE",
    },
  ],
};
const entryOf = (id: string) => (id === "gun_a" ? gunEntry : id === "pump" ? pumpEntry : undefined);

const Plan = ({
  onChange,
  onAutoPlace = () => {},
  fittingAt = () => null,
}: {
  readonly onChange: (t: PlanTool) => void;
  readonly onAutoPlace?: () => void;
  readonly fittingAt?: () => string | null;
}) => {
  const [tool, setTool] = useState<PlanTool>(IDLE_TOOL);
  return (
    <PlanContextMenu
      tool={tool}
      onTool={(next) => {
        setTool(next);
        onChange(next);
      }}
      draft={draft}
      available={[gunEntry, pumpEntry]}
      entryOf={entryOf}
      onAutoPlace={onAutoPlace}
      fittingAt={fittingAt}
    >
      <svg aria-label="drawing" />
    </PlanContextMenu>
  );
};

const openMenu = () => fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
const click = async (name: string) =>
  fireEvent.click(await screen.findByRole("menuitem", { name }));

describe("PlanContextMenu", () => {
  it("is reachable from the keyboard: the plan takes focus", () => {
    render(<Plan onChange={() => {}} />);
    expect(screen.getByRole("group", { name: /^Ship plan/ }).tabIndex).toBe(0);
  });

  it("arms the place tool from Place, by category then component", async () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<Plan onChange={onChange} />);
    openMenu();
    await click("Place");
    await click("Main gun");
    await click("Gun A");
    expect(onChange).toHaveBeenLastCalledWith({
      ...IDLE_TOOL,
      mode: "place",
      componentId: "gun_a",
    });
  });

  it("arms the move tool from Move, naming the fitting", async () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<Plan onChange={onChange} />);
    openMenu();
    await click("Move");
    await click("Gun A (gun_1)");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "move", instanceId: "gun_1" });
  });

  it("offers Move this fitting for the fitting under the pointer", async () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<Plan onChange={onChange} fittingAt={() => "gun_1"} />);
    openMenu();
    await click("Move this fitting");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "move", instanceId: "gun_1" });
  });

  it("does not offer Move this fitting when nothing is under the pointer", async () => {
    render(<Plan onChange={() => {}} />);
    openMenu();
    await screen.findByRole("menuitem", { name: "Place" });
    expect(screen.queryByRole("menuitem", { name: "Move this fitting" })).toBeNull();
  });

  it("keeps Auto-place disabled until a component is chosen, then runs it", async () => {
    const onAutoPlace = vi.fn<() => void>();
    render(<Plan onChange={() => {}} onAutoPlace={onAutoPlace} />);
    openMenu();
    const idle = await screen.findByRole("menuitem", { name: "Auto-place" });
    expect(idle.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(idle, { key: "Escape" });
    openMenu();
    await click("Place");
    await click("Damage control");
    await click("Pump");
    openMenu();
    await click("Auto-place Pump");
    expect(onAutoPlace).toHaveBeenCalledOnce();
  });

  it("offers Stop only while a tool is armed, and it turns the tool off", async () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<Plan onChange={onChange} />);
    openMenu();
    await screen.findByRole("menuitem", { name: "Place" });
    expect(screen.queryByRole("menuitem", { name: /^Stop/ })).toBeNull();
    await click("Move");
    await click("Gun A (gun_1)");
    openMenu();
    await click("Stop moving");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "off", instanceId: "gun_1" });
  });

  it("names nothing to place when nothing is available", async () => {
    render(
      <PlanContextMenu
        tool={IDLE_TOOL}
        onTool={() => {}}
        draft={draft}
        available={[]}
        entryOf={entryOf}
        onAutoPlace={() => {}}
        fittingAt={() => null}
      >
        <svg aria-label="drawing" />
      </PlanContextMenu>,
    );
    openMenu();
    await click("Place");
    const note = await screen.findByRole("menuitem", { name: "Nothing can be fitted this month" });
    expect(within(note.parentElement!).getByText(/Nothing can be fitted/)).toBeTruthy();
  });
});
