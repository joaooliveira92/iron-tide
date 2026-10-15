import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { axeViolations } from "../../../lib/axe.js";
import { DockCapacityPanel, type DockCapacityPanelProps } from "./DockCapacityPanel.js";

afterEach(cleanup);

const props = (over: Partial<DockCapacityPanelProps> = {}): DockCapacityPanelProps => ({
  dockMaxBuildDisplacementKg: 13_000_000,
  maxConcurrentConstructionMassKg: 39_000_000,
  committedNewConstructionMassKg: 2_000_000,
  exemptNewConstructionMassKg: 8_000_000,
  dockExpansionDurationMonths: 12,
  dockExpansionNextStepKg: 1_000_000,
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
    expect(screen.getByTestId("dock-size").textContent).toBe("13,000,000");
    expect(screen.getByTestId("concurrency-cap").textContent).toBe("39,000,000");
    expect(screen.getByTestId("capacity-in-use").textContent).toBe("2,000,000");
    expect(screen.getByTestId("capacity-exempt").textContent).toBe("8,000,000");
    expect(screen.getByTestId("dock-expansion").textContent).toBe(
      "12 months · next step 1,000,000 kg",
    );
  });

  it("discloses 'no era step' when the month has no era step", () => {
    render(<DockCapacityPanel {...props({ dockExpansionNextStepKg: null })} />);
    expect(screen.getByTestId("dock-expansion").textContent).toBe("12 months · no era step");
  });

  it("says 'no dock' instead of fabricating a zero when the dock is unresolvable", () => {
    render(<DockCapacityPanel {...props({ dockMaxBuildDisplacementKg: null })} />);
    expect(screen.getByTestId("dock-size").textContent).toBe("no dock");
  });

  it("issues the expansion for the first possession when the action is used", () => {
    let issued: string | null = null;
    render(
      <DockCapacityPanel
        {...props({
          onAuthorizeDockExpansion: (id) => {
            issued = id;
          },
        })}
      />,
    );
    screen.getByRole("button", { name: "Authorize dock expansion" }).click();
    expect(issued).toBe("pos-1");
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
    screen.getByRole("button", { name: "Authorize dock expansion" }).click();
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
