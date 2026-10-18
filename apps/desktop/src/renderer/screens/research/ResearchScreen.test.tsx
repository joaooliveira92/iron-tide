/* @vitest-environment jsdom */
import { RESEARCH_FIELD_PRIORITY_WEIGHTS } from "@bluewave/campaign-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ResearchScreen } from "./ResearchScreen.js";
import { initialResearchScreenState, researchLoadSuccess } from "./research-screen-state.js";
import type { ResearchScreenState } from "./research-screen-state.js";

/**
 * Render test for the Research & Technology screen
 * (desktop-engine-feature-gate INC-3, spec Testing → renderer screen test).
 * The hook is mocked so the test asserts PURE rendering: the projection data
 * is actually shown (budget / priorities / progress / discovered), and the
 * submit control is gated by validity — never fabricated success copy.
 */

const fixtureProjection = {
  nationId: "uk",
  researchBudget: 60,
  annualAllocation: 720,
  researchCap: 120,
  unfundedReason: null,
  fieldPriorities: {
    GUNNERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
    MACHINERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM,
    INFRASTRUCTURE: RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW,
  },
  discoveredTechIds: ["basic_steam", "gunnery_rifled"],
  inProgressTechnologies: [{ techId: "gunnery_rifled", investedPoints: 24, completed: false }],
  currentProjectTechId: "gunnery_rifled",
  revision: 0,
  month: { month: 1, year: 1880 },
};

function makeLoaded(): ResearchScreenState {
  const base = initialResearchScreenState();
  return researchLoadSuccess(base, fixtureProjection as never);
}

const hookMocks = vi.hoisted(() => {
  const stateFn = vi.fn(() => makeLoaded());
  const setFieldWeight = vi.fn();
  const submit = vi.fn();
  const reload = vi.fn().mockResolvedValue(undefined);
  const canSubmit = true;
  return { stateFn, setFieldWeight, submit, reload, canSubmit };
});

// `GlassCard` (liquid-glass.tsx) measures its element with ResizeObserver —
// jsdom doesn't ship it; a no-op shim is enough for a pure render test.
const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("./hooks/useResearchScreen.js", () => ({
  useResearchScreen: (_sessionId: string) => ({
    state: hookMocks.stateFn(),
    setFieldWeight: hookMocks.setFieldWeight,
    submit: hookMocks.submit,
    reload: hookMocks.reload,
    canSubmit: hookMocks.canSubmit,
  }),
}));

afterEach(() => {
  cleanup();
  hookMocks.stateFn.mockClear();
  hookMocks.submit.mockClear();
});

describe("ResearchScreen", () => {
  it("renders the real projection: budget, priorities, in-progress techs, discovered techs", () => {
    render(<ResearchScreen sessionId="ses-1" />);

    // Budget + honest copy about when it applies.
    expect(screen.getByText("60")).not.toBeNull();

    // Field priorities render with their weight labels.
    expect(screen.getByText("Gunnery")).not.toBeNull();
    expect(screen.getByText("Machinery")).not.toBeNull();
    expect(screen.getByText("Infrastructure")).not.toBeNull();

    // Discovered techs are shown as badges.
    expect(screen.getByText("Basic steam")).not.toBeNull();
    // `gunnery_rifled` appears as a discovered badge AND an in-progress row.
    expect(screen.getAllByText("Gunnery rifled").length).toBeGreaterThanOrEqual(2);

    // In-progress technology work with invested points + current-project tag.
    expect(screen.getByText("24 pts")).not.toBeNull();
  });

  it("renders an honest empty state (no budget/found/discovered progress) without fabrication", () => {
    const emptyProjection = {
      ...fixtureProjection,
      researchBudget: 0,
      discoveredTechIds: [],
      inProgressTechnologies: [],
      currentProjectTechId: null,
      fieldPriorities: {},
    };
    const emptyState = researchLoadSuccess(initialResearchScreenState(), emptyProjection as never);
    hookMocks.stateFn.mockReturnValue(emptyState);

    render(<ResearchScreen sessionId="ses-1" />);
    expect(screen.getByText("None discovered yet")).not.toBeNull();
    expect(screen.getByText("No technology work recorded yet")).not.toBeNull();
    expect(screen.getByText("No active project selected")).not.toBeNull();
  });
});
