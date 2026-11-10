import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { applyDockExpansionStep, dockLimitAfterExpansionExplanation } from "@bluewave/phase-engine";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { axeViolations } from "../../../lib/axe.js";
import { DockCapacityPanel, type DockCapacityPanelProps } from "./DockCapacityPanel.js";

afterEach(cleanup);

const DOCK = {
  maximumNewConstructionMassKg: 13_000_000,
  maximumMajorRepairMassKg: 13_000_000,
  maximumRebuildMassKg: 13_000_000,
  maximumConversionMassKg: 13_000_000,
};
const AFTER_TREE = dockLimitAfterExpansionExplanation(DOCK, 1_000_000);

const props = (over: Partial<DockCapacityPanelProps> = {}): DockCapacityPanelProps => ({
  dockMaxBuildDisplacementKg: 13_000_000,
  maxConcurrentConstructionMassKg: 39_000_000,
  committedNewConstructionMassKg: 2_000_000,
  exemptNewConstructionMassKg: 8_000_000,
  dockExpansionDurationMonths: 12,
  dockExpansionNextStepKg: 1_000_000,
  dockExpansionReadyMonth: "1880-12",
  dockLimitAfterExpansionExplanation: AFTER_TREE,
  dockPossessions: [{ id: "pos-1", name: "Portsmouth" }],
  pending: false,
  onAuthorizeDockExpansion: () => {},
  ...over,
});

describe("DockCapacityPanel (SB3-R15/R16/R18/R19/R33)", () => {
  it("shows the compiled dock size, cap, utilisation split and expansion figures", () => {
    render(<DockCapacityPanel {...props()} />);
    const figures = screen.getByRole("list", { name: "Dock and capacity figures" });
    expect(figures.textContent).toContain("Dock size");
    expect(screen.getByTestId("dock-size").textContent).toBe("13,000 t");
    expect(screen.getByTestId("concurrency-cap").textContent).toBe("39,000 t");
    expect(screen.getByTestId("capacity-in-use").textContent).toBe("2,000 t");
    expect(screen.getByTestId("capacity-exempt").textContent).toBe("8,000 t");
    expect(screen.getByTestId("dock-expansion").textContent).toBe("12 months · next step 1,000 t");
  });

  it("discloses 'no era step' when the month has no era step", () => {
    render(<DockCapacityPanel {...props({ dockExpansionNextStepKg: null })} />);
    expect(screen.getByTestId("dock-expansion").textContent).toBe("12 months · no era step");
  });

  it("says 'no dock' instead of fabricating a zero when the dock is unresolvable", () => {
    render(<DockCapacityPanel {...props({ dockMaxBuildDisplacementKg: null })} />);
    expect(screen.getByTestId("dock-size").textContent).toBe("no dock");
  });

  it("opens the confirmation without sending a command", () => {
    const issued: string[] = [];
    render(<DockCapacityPanel {...props({ onAuthorizeDockExpansion: (id) => issued.push(id) })} />);
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(issued).toEqual([]);
  });

  it("cancelling the confirmation sends no command", () => {
    const issued: string[] = [];
    render(<DockCapacityPanel {...props({ onAuthorizeDockExpansion: (id) => issued.push(id) })} />);
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(issued).toEqual([]);
  });

  it("confirming sends exactly one expansion command for the chosen possession", () => {
    const issued: string[] = [];
    render(<DockCapacityPanel {...props({ onAuthorizeDockExpansion: (id) => issued.push(id) })} />);
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    fireEvent.click(screen.getByRole("button", { name: "Authorize expansion" }));
    expect(issued).toEqual(["pos-1"]);
  });

  it("shows the earliest completion month, duration, next step and current dock limit in the confirmation", () => {
    render(<DockCapacityPanel {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("funded from the construction budget");
    expect(screen.getByTestId("expansion-ready-month").textContent).toContain("1880");
    expect(screen.getByTestId("expansion-duration").textContent).toContain("12");
    expect(screen.getByTestId("expansion-next-step").textContent).toBe("+1,000 t");
    expect(screen.getByTestId("expansion-dock-limit").textContent).toBe("13,000 t → 14,000 t");
    expect(dialog.textContent).not.toMatch(/price|instalment|cost/i);
  });

  it("shows the dock limit after expansion exactly as the engine step computes it", () => {
    const afterKg = applyDockExpansionStep(DOCK, 1_000_000).maximumNewConstructionMassKg;
    expect(afterKg).toBe(14_000_000);
    expect(Number(AFTER_TREE?.result)).toBe(afterKg);
    render(<DockCapacityPanel {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    expect(screen.getByTestId("expansion-dock-limit").textContent).toBe("13,000 t → 14,000 t");
    expect(screen.getByTestId("explanation-dock_limit_after_expansion").textContent).toContain(
      "Dock limit after expansion 14,000,000",
    );
  });

  it("shows only the current limit when no tree explains an after figure", () => {
    render(<DockCapacityPanel {...props({ dockLimitAfterExpansionExplanation: undefined })} />);
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    expect(screen.getByTestId("expansion-dock-limit").textContent).toBe("13,000 t");
    expect(screen.queryByTestId("explanation-dock_limit_after_expansion")).toBeNull();
  });

  it("disables the action when there is no era step", () => {
    render(<DockCapacityPanel {...props({ dockExpansionNextStepKg: null })} />);
    expect(screen.getByRole("button", { name: "Authorize dock expansion" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("disables the action while a command is pending", () => {
    render(<DockCapacityPanel {...props({ pending: true })} />);
    expect(screen.getByRole("button", { name: "Authorize dock expansion" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("lets the player choose among several possessions before authorizing", () => {
    let issued: string | null = null;
    render(
      <DockCapacityPanel
        {...props({
          dockPossessions: [
            { id: "pos-1", name: "Portsmouth" },
            { id: "pos-2", name: "Malta" },
          ],
          onAuthorizeDockExpansion: (id) => {
            issued = id;
          },
        })}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Dock expansion possession" });
    fireEvent.change(select, { target: { value: "pos-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Authorize dock expansion" }));
    fireEvent.click(screen.getByRole("button", { name: "Authorize expansion" }));
    expect(issued).toBe("pos-2");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <DockCapacityPanel
        {...props({
          dockPossessions: [
            { id: "pos-1", name: "Portsmouth" },
            { id: "pos-2", name: "Malta" },
          ],
        })}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
