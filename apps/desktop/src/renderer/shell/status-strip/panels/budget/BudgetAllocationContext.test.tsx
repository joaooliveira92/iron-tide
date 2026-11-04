/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import type { BudgetAllocation } from "../../../status-strip-state.js";
import {
  BudgetAllocationProvider,
  useBudgetAllocationActions,
  useBudgetAllocationMeta,
  useBudgetAllocationState,
} from "./BudgetAllocationContext.js";

const ALLOCATION: BudgetAllocation = {
  appropriation: "5,000 NC",
  segments: [
    {
      id: "maintenance",
      label: "Maintenance",
      value: "2,000 NC",
      kind: "committed",
      percent: "40%",
      fraction: 0.4,
      shareOfCommitted: "40%",
      yearly: "24,000 NC",
    },
    {
      id: "research",
      label: "Research",
      value: "800 NC",
      kind: "committed",
      percent: "16%",
      fraction: 0.16,
      shareOfCommitted: "16%",
      yearly: "9,600 NC",
    },
  ],
  committed: { value: "2,800 NC", percent: "56%" },
  overCommitted: false,
  limit: 1,
};

const NOTE_FOR = (id: (typeof ALLOCATION.segments)[number]["id"]) => `note:${id}`;

function ActiveProbe() {
  const { active } = useBudgetAllocationState();
  return <output data-testid="active">{active ?? "none"}</output>;
}

function ControlProbe() {
  const { activate, clear } = useBudgetAllocationActions();
  return (
    <div>
      <button type="button" onClick={() => activate("research")}>
        research
      </button>
      <button type="button" onClick={clear}>
        clear
      </button>
    </div>
  );
}

function MetaProbe() {
  const { noteFor, limit } = useBudgetAllocationMeta();
  return (
    <output data-testid="meta">
      {noteFor("research")}:{limit === null ? "none" : String(limit)}
    </output>
  );
}

function renderSiblings(allocation: BudgetAllocation = ALLOCATION) {
  return render(
    <BudgetAllocationProvider allocation={allocation} noteFor={NOTE_FOR}>
      <ActiveProbe />
      <ControlProbe />
      <MetaProbe />
    </BudgetAllocationProvider>,
  );
}

describe("BudgetAllocationContext", () => {
  afterEach(cleanup);

  it("shares the active segment between sibling parts", () => {
    renderSiblings();
    expect(screen.getByTestId("active").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "research" }));
    expect(screen.getByTestId("active").textContent).toBe("research");

    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByTestId("active").textContent).toBe("none");
  });

  it("exposes the notes and a limit only when over-committed", () => {
    renderSiblings();
    expect(screen.getByTestId("meta").textContent).toBe("note:research:none");

    cleanup();
    renderSiblings({ ...ALLOCATION, overCommitted: true });
    expect(screen.getByTestId("meta").textContent).toBe("note:research:1");
  });

  it("refuses a hook used outside the provider", () => {
    expect(() => render(<ActiveProbe />)).toThrow(/BUDGET_ALLOCATION_PROVIDER_MISSING/);
  });
});
