/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { BudgetScreenProjection } from "../../../../shared/budget-contract.js";
import { BudgetPolicyPanel } from "./BudgetPolicyPanel.js";

const projection: BudgetScreenProjection = {
  revision: 4,
  month: { month: 3, year: 1880 },
  appropriationRateBp: 2000,
  researchBudget: 60,
  bounds: {
    appropriationRateMinBp: 500,
    appropriationRateMaxBp: 5000,
    researchBudgetMin: 0,
    researchBudgetMax: 1000,
  },
  // base 120000: cap = floor(12% x floor(6000 x rate / 120000)), one entry per 50 bp step.
  researchCaps: Array.from({ length: 91 }, (_, i) => ({
    rateBp: 500 + i * 50,
    cap: Math.floor((Math.floor((120000 * (500 + i * 50)) / 120000) * 1200) / 10000),
  })),
};

class ResizeObserverMock implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const execute = vi.fn();

beforeEach(() => {
  execute.mockReset();
  execute.mockImplementation((command: string) =>
    Promise.resolve(
      command === "inspectBudgetScreen"
        ? { outcome: "success", value: projection, diagnostics: [] }
        : {
            outcome: "success",
            value: { commandId: "c1", bodyType: "SetBudgetAllocation", appliedOnNextTurn: true },
            diagnostics: [],
          },
    ),
  );
  vi.stubGlobal("window", Object.assign(window, { bluewave: { campaign: { execute } } }));
});

afterEach(() => {
  cleanup();
});

describe("BudgetPolicyPanel", () => {
  it("shows the engine's current allocation and bounds, and Apply starts disabled", async () => {
    render(<BudgetPolicyPanel sessionId="ses-1" />);
    const rate = (await screen.findByLabelText("Naval appropriation rate")) as HTMLInputElement;
    expect(rate.value).toBe("2000");
    expect(rate.min).toBe("500");
    expect(rate.max).toBe("5000");
    expect(screen.getByText("20.0%")).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "Apply allocation" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("queues the changed allocation through the bridge and says it applies next month", async () => {
    render(<BudgetPolicyPanel sessionId="ses-1" />);
    const research = await screen.findByLabelText("Research budget per month");
    fireEvent.change(research, { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply allocation" }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        "submitBudgetAllocation",
        expect.objectContaining({
          sessionId: "ses-1",
          expectedRevision: 4,
          appropriationRateBp: 2000,
          researchBudget: 200,
        }),
      ),
    );
    expect(await screen.findByText(/applies it when you advance the month/)).not.toBeNull();
  });
});
