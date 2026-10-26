import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { FleetExerciseProjection } from "../../../../shared/fleet-contract.js";
import { FleetExerciseView } from "./FleetExerciseSection.js";
import {
  explainExerciseRejection,
  initialExerciseState,
  type ExerciseShipRow,
  type ExerciseState,
} from "./exercise-model.js";

const exercise = (over: Partial<FleetExerciseProjection> = {}): FleetExerciseProjection => ({
  maxPerCalendarYear: 1,
  maintenanceMultiple: 2,
  experienceGain: 5,
  nextExerciseYear: 1880,
  heldInNextExerciseYear: 0,
  ...over,
});

const row = (shipId: string, over: Partial<ExerciseShipRow> = {}): ExerciseShipRow => ({
  shipId,
  name: `HMS ${shipId}`,
  areaId: "home",
  eligible: true,
  exercising: false,
  ...over,
});

function renderView(
  projection: FleetExerciseProjection | null,
  rows: ExerciseShipRow[] = [],
  over: { selected?: string[]; busy?: boolean } = {},
) {
  const state: ExerciseState = { ...initialExerciseState(), exercise: projection };
  const onToggle = vi.fn();
  const onHold = vi.fn(() => Promise.resolve("accepted" as const));
  render(
    <FleetExerciseView
      state={state}
      rows={rows}
      selected={over.selected ?? []}
      loadError={null}
      busy={over.busy ?? false}
      outcomeUnknown={false}
      onToggle={onToggle}
      onHold={onHold}
      onRetry={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  return { onToggle, onHold };
}

describe("FleetExerciseView", () => {
  afterEach(cleanup);

  it("renders nothing while the fleet-management section is dormant", () => {
    renderView(null);
    expect(screen.queryByTestId("fleet-exercise")).toBeNull();
  });

  it("states the cost, lets the player pick eligible ships and holds the exercise", () => {
    const { onToggle, onHold } = renderView(exercise(), [row("a"), row("b")], {
      selected: ["a"],
    });
    expect(screen.getByText(/cost 2 times their active maintenance/)).toBeTruthy();
    expect(screen.getByText(/gain 5 experience/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Exercise HMS b"));
    expect(onToggle).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("button", { name: "Hold fleet exercise" }));
    expect(onHold).toHaveBeenCalled();
  });

  it("shows the exercise-gain explanation when supplied", () => {
    renderView(
      exercise({
        experienceGainExplanation: {
          formulaId: "fleet_exercise_gain",
          formulaVersion: "fleet_v1",
          inputs: { perExercise: 5 },
          intermediate: {},
          result: 5,
          children: [],
        },
      }),
    );
    expect(screen.getByText("Exercise gain 5 experience")).toBeTruthy();
  });

  it("disables the order with no ships chosen and everything while busy", () => {
    renderView(exercise(), [row("a")]);
    expect(
      (screen.getByRole("button", { name: "Hold fleet exercise" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    renderView(exercise(), [row("a")], { selected: ["a"], busy: true });
    expect(
      (screen.getByRole("button", { name: "Hold fleet exercise" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText("Exercise HMS a") as HTMLInputElement).disabled).toBe(true);
  });

  it("shows the scheduled exercise and withdraws the order once the year's limit is used", () => {
    renderView(
      exercise({
        heldInNextExerciseYear: 1,
        scheduled: { month: "1880-03", shipIds: ["a", "b"] },
      }),
      [row("a", { eligible: false, exercising: true })],
    );
    expect(screen.getByTestId("fleet-exercise-scheduled").textContent).toBe(
      "Exercise set for 1880-03 with 2 ships.",
    );
    expect(screen.getByText(/already been ordered/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hold fleet exercise" })).toBeNull();
  });
});

describe("explainExerciseRejection", () => {
  it("names each refused ship with its reason", () => {
    const lines = explainExerciseRejection(
      ["Fleet exercise rejected: a=Mothballed, b=InBattle"],
      [row("a"), row("b")],
    );
    expect(lines).toEqual([
      "Fleet exercise rejected. Nothing was queued.",
      "HMS a is mothballed.",
      "HMS b is committed to a battle.",
    ]);
  });
});
