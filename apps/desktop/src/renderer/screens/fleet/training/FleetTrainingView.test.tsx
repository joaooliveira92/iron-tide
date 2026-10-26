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

function renderView(projection: FleetTrainingProjection | null, over: { busy?: boolean } = {}) {
  const onFund = vi.fn((_subjects: readonly string[]) => Promise.resolve("accepted" as const));
  const props = {
    loadError: null,
    busy: over.busy ?? false,
    outcomeUnknown: false,
    onFund,
    onRetry: vi.fn(),
    onReload: vi.fn(),
  };
  const view = render(<FleetTrainingView state={stateOf(projection)} {...props} />);
  return { onFund, view, props };
}

const apply = () => screen.getByRole("button", { name: "Apply training" }) as HTMLButtonElement;

describe("FleetTrainingView", () => {
  afterEach(cleanup);

  it("renders nothing while the fleet-management section is dormant", () => {
    renderView(null);
    expect(screen.queryByTestId("fleet-training")).toBeNull();
  });

  it("shows each subject's cost and progress and applies nothing until the selection changes", () => {
    renderView(training({ GUNNERY: 5 }));
    expect(screen.getByText("+30% maintenance on active ships")).toBeTruthy();
    expect(screen.getByText("5 of 12 months")).toBeTruthy();
    expect(screen.getAllByText("Not funded")).toHaveLength(3);
    expect((screen.getByLabelText("Fund Gunnery") as HTMLInputElement).checked).toBe(true);
    expect(apply().disabled).toBe(true);
  });

  it("lets two subjects be chosen before sending the whole set once", () => {
    const { onFund } = renderView(training());
    fireEvent.click(screen.getByLabelText("Fund Gunnery"));
    fireEvent.click(screen.getByLabelText("Fund Night fighting"));
    expect(apply().disabled).toBe(false);
    fireEvent.click(apply());
    expect(onFund).toHaveBeenCalledTimes(1);
    expect(onFund).toHaveBeenCalledWith(["GUNNERY", "NIGHT_FIGHTING"]);
  });

  it("warns that dropped subjects lose their progress and sends the remaining ones", () => {
    const { onFund } = renderView(training({ GUNNERY: 12, DAMAGE_CONTROL: 2 }));
    expect(screen.getByText("Proficient")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Fund Gunnery"));
    expect(screen.getByText("Dropped subjects lose their progress.")).toBeTruthy();
    fireEvent.click(apply());
    expect(onFund).toHaveBeenCalledWith(["DAMAGE_CONTROL"]);
  });

  it("disables the unchosen subjects at the limit and every control while busy", () => {
    renderView(training({ GUNNERY: 1, NIGHT_FIGHTING: 1 }));
    const torpedo = screen.getByLabelText("Fund Torpedo tactics") as HTMLInputElement;
    expect(torpedo.disabled).toBe(true);
    expect(torpedo.getAttribute("title")).toBe("At most 2 subjects can be funded at once");
    cleanup();
    renderView(training(), { busy: true });
    for (const box of screen.getAllByRole("checkbox"))
      expect((box as HTMLInputElement).disabled).toBe(true);
    expect(apply().disabled).toBe(true);
  });

  it("drops an unsent selection when the projection changes underneath it", () => {
    const { view, props } = renderView(training());
    fireEvent.click(screen.getByLabelText("Fund Gunnery"));
    view.rerender(
      <FleetTrainingView state={stateOf(training({ DAMAGE_CONTROL: 1 }))} {...props} />,
    );
    expect((screen.getByLabelText("Fund Gunnery") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Fund Damage control") as HTMLInputElement).checked).toBe(true);
  });
});
