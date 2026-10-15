import { useState } from "react";
import type { DesignDraft, MountSide, PartCatalogueEntry } from "@bluewave/ship-design";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { PlanModeButtons, PlanToolOptions } from "./PlanToolbar.js";
import { IDLE_TOOL, type PlanTool } from "./plan-tool.js";

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

const ModeButtons = ({
  onChange,
  onAutoPlace = () => {},
}: {
  readonly onChange: (t: PlanTool) => void;
  readonly onAutoPlace?: () => void;
}) => {
  const [tool, setTool] = useState<PlanTool>(IDLE_TOOL);
  return (
    <PlanModeButtons
      tool={tool}
      onTool={(next) => {
        setTool(next);
        onChange(next);
      }}
      draft={draft}
      available={[gunEntry, pumpEntry]}
      entryOf={entryOf}
      onAutoPlace={onAutoPlace}
    />
  );
};

describe("PlanModeButtons", () => {
  it("opens a menu and turns the tool on; pressing the active tool again turns it off", () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<ModeButtons onChange={onChange} />);
    const place = screen.getByRole("button", { name: "Place on plan" });
    expect(place.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(place);
    expect(place.getAttribute("aria-pressed")).toBe("true");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "place" });
    expect(screen.getByLabelText("Component to place")).toBeTruthy();
    fireEvent.click(place);
    expect(place.getAttribute("aria-pressed")).toBe("false");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "off" });
    expect(screen.queryByLabelText("Component to place")).toBeNull();
  });

  it("switches between modes, one at a time, keeping a single picker open", () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<ModeButtons onChange={onChange} />);
    const place = screen.getByRole("button", { name: "Place on plan" });
    const move = screen.getByRole("button", { name: "Move on plan" });
    fireEvent.click(place);
    // The other mode's menu replaces it, so only one picker is offered at a time.
    fireEvent.click(move);
    expect(place.getAttribute("aria-pressed")).toBe("false");
    expect(move.getAttribute("aria-pressed")).toBe("true");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "move" });
    expect(screen.getByLabelText("Fitting to move")).toBeTruthy();
    expect(screen.queryByLabelText("Component to place")).toBeNull();
  });

  it("keeps the place menu open on a choice so Auto-place stays reachable, and runs it", () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    const onAutoPlace = vi.fn<() => void>();
    render(<ModeButtons onChange={onChange} onAutoPlace={onAutoPlace} />);
    const place = screen.getByRole("button", { name: "Place on plan" });
    fireEvent.click(place);
    const auto = () => screen.getByRole("button", { name: "Auto-place" }) as HTMLButtonElement;
    expect(auto().disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Component to place"));
    fireEvent.click(screen.getByRole("option", { name: "Gun A" }));
    // The menu stays open and Auto-place is now enabled.
    expect(screen.getByLabelText("Component to place")).toBeTruthy();
    expect(auto().disabled).toBe(false);
    fireEvent.click(auto());
    expect(onAutoPlace).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Component to place")).toBeNull();
    expect(place.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(place);
    expect(place.getAttribute("aria-pressed")).toBe("false");
  });

  it("closes the move menu on a choice; pressing the active tool again turns it off", () => {
    const onChange = vi.fn<(t: PlanTool) => void>();
    render(<ModeButtons onChange={onChange} />);
    const move = screen.getByRole("button", { name: "Move on plan" });
    fireEvent.click(move);
    fireEvent.click(screen.getByLabelText("Fitting to move"));
    fireEvent.click(screen.getByRole("option", { name: "Gun A (gun_1)" }));
    // The move menu's controls live on the panel, so it closes on a choice; the tool stays on.
    expect(screen.queryByLabelText("Fitting to move")).toBeNull();
    expect(move.getAttribute("aria-pressed")).toBe("true");
    // Pressing the active tool again turns it off.
    fireEvent.click(move);
    expect(move.getAttribute("aria-pressed")).toBe("false");
    expect(onChange).toHaveBeenLastCalledWith({ ...IDLE_TOOL, mode: "off", instanceId: "gun_1" });
  });

  it("explains how to use the place tool in a hover tooltip on its button", async () => {
    render(<ModeButtons onChange={() => {}} />);
    fireEvent.focus(screen.getByRole("button", { name: "Place on plan" }));
    const tip = await screen.findByText(/Choose a component in the Place menu/);
    expect(tip).toBeTruthy();
  });

  it("gives each placeable option its category icon and description", () => {
    render(<ModeButtons onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Place on plan" }));
    fireEvent.click(screen.getByLabelText("Component to place"));
    const option = screen.getByRole("option", { name: "Gun A" });
    expect(within(option).getByText("Main-battery gun.")).toBeTruthy();
    expect(option.querySelector("svg")).toBeTruthy();
  });

  it("gives each fitting option its category icon and description", () => {
    render(<ModeButtons onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Move on plan" }));
    fireEvent.click(screen.getByLabelText("Fitting to move"));
    const option = screen.getByRole("option", { name: "Gun A (gun_1)" });
    expect(within(option).getByText("Main-battery gun.")).toBeTruthy();
    expect(option.querySelector("svg")).toBeTruthy();
  });
});

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
    expect(within(options).getByRole("status").textContent).toMatch(/Use the Place and Move tools/);
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
});
