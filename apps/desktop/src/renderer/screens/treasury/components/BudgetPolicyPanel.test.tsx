/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { BudgetScreenProjection } from "../../../../shared/budget-contract.js";
import { useBudgetPolicy } from "../hooks/useBudgetPolicyPanel.js";
import { BudgetPolicyPanel } from "./BudgetPolicyPanel.js";

function Harness({ sessionId }: { readonly sessionId: string }) {
  return <BudgetPolicyPanel policy={useBudgetPolicy(sessionId)} />;
}

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
  commitments: {
    fleet: { total: 0, atWar: false, warSurcharge: 0, groups: [], ships: [] },
    construction: {
      projects: [],
      drawTotal: 0,
      carryingTotal: 0,
      haltedCount: 0,
      acceleration: { acceleratedCount: 0, delayChanceBp: 0, premiumBp: 500, premiumPending: 0 },
    },
    unpaidCostsPrestige: null,
  },
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
    render(<Harness sessionId="ses-1" />);
    const rate = (await screen.findByLabelText("Naval appropriation rate")) as HTMLInputElement;
    expect(rate.value).toBe("2000");
    expect(rate.min).toBe("500");
    expect(rate.max).toBe("5000");
    expect(screen.getAllByText("20%").length).toBeGreaterThan(0);
    expect(
      (screen.getByRole("button", { name: "Apply allocation" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows what is in force and offers a reset once a dial moves", async () => {
    render(<Harness sessionId="ses-1" />);
    const research = await screen.findByLabelText("Research budget per month");
    fireEvent.change(research, { target: { value: "120" } });
    expect(screen.getByText("was 60")).not.toBeNull();
    expect(screen.getByText("Unapplied")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect((research as HTMLInputElement).value).toBe("60");
    expect(screen.queryByText("Unapplied")).toBeNull();
  });

  it("nudges a dial by one step from its stepper buttons", async () => {
    render(<Harness sessionId="ses-1" />);
    await screen.findByLabelText("Naval appropriation rate");
    fireEvent.click(screen.getByRole("button", { name: "Increase naval appropriation rate" }));
    expect((screen.getByLabelText("Naval appropriation rate") as HTMLInputElement).value).toBe(
      "2050",
    );
  });

  it("queues the changed allocation through the bridge and says it applies next month", async () => {
    render(<Harness sessionId="ses-1" />);
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
