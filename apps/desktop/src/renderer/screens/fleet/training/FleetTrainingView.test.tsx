import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { FleetTrainingProjection } from "../../../../shared/fleet-contract.js";
import { FleetTrainingView } from "./FleetTrainingSection.js";
import { initialTrainingState, type TrainingState } from "./training-model.js";

const training = (funded: Record<string, number> = {}): FleetTrainingProjection => ({
  maxSubjects: 2,
  proficiencyMonths: 12,
  subjects: (
    [
      ["GUNNERY", 3000],
      ["NIGHT_FIGHTING", 2000],
      ["TORPEDO_TACTICS", 2000],
      ["DAMAGE_CONTROL", 2000],
    ] as const
  ).map(([subject, maintenanceAdderBp]) => ({
    subject,
    maintenanceAdderBp,
    funded: subject in funded,
    fundedMonths: funded[subject] ?? 0,
    proficient: (funded[subject] ?? 0) >= 12,
  })),
});

const stateOf = (projection: FleetTrainingProjection | null): TrainingState => ({
  ...initialTrainingState(),
  training: projection,
});

function renderView(
  projection: FleetTrainingProjection | null,
  over: { busy?: boolean; onFund?: (subjects: readonly string[]) => Promise<"accepted"> } = {},
) {
  const onFund = vi.fn(over.onFund ?? (() => Promise.resolve("accepted" as const)));
  render(
    <FleetTrainingView
      state={stateOf(projection)}
      loadError={null}
      busy={over.busy ?? false}
      outcomeUnknown={false}
      onFund={onFund}
      onRetry={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  return { onFund };
}

describe("FleetTrainingView", () => {
  afterEach(cleanup);

  it("renders nothing while the fleet-management section is dormant", () => {
    renderView(null);
    expect(screen.queryByTestId("fleet-training")).toBeNull();
  });

  it("shows each subject's cost and progress, and funds one more with the existing ones kept", () => {
    const { onFund } = renderView(training({ GUNNERY: 5 }));
    expect(screen.getByText("+30% maintenance on active ships")).toBeTruthy();
    expect(screen.getByText("5 of 12 months")).toBeTruthy();
    expect(screen.getAllByText("Not funded")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Fund Night fighting" }));
    expect(onFund).toHaveBeenCalledWith(["GUNNERY", "NIGHT_FIGHTING"]);
  });

  it("stops funding a subject by sending the remaining ones", () => {
    const { onFund } = renderView(training({ GUNNERY: 12, DAMAGE_CONTROL: 2 }));
    expect(screen.getByText("Proficient")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop funding Gunnery" }));
    expect(onFund).toHaveBeenCalledWith(["DAMAGE_CONTROL"]);
  });

  it("disables unfunded subjects at the limit and every control while busy", () => {
    renderView(training({ GUNNERY: 1, NIGHT_FIGHTING: 1 }));
    const torpedo = screen.getByRole("button", { name: "Fund Torpedo tactics" });
    expect((torpedo as HTMLButtonElement).disabled).toBe(true);
    expect(torpedo.getAttribute("title")).toBe("At most 2 subjects can be funded at once");
    cleanup();
    renderView(training(), { busy: true });
    for (const button of screen.getAllByRole("button"))
      expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
