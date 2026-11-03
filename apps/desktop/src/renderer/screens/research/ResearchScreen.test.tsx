/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ResearchScreen } from "./ResearchScreen.js";
import { researchLoadSuccess } from "./research-screen-state.js";
import type { ResearchScreenState } from "./research-screen-state.js";
import { fixtureProjection } from "./research-test-fixtures.js";

function makeLoaded(overrides = {}): ResearchScreenState {
  return researchLoadSuccess(fixtureProjection(overrides));
}

const hookMocks = vi.hoisted(() => ({
  stateFn: vi.fn(),
  setFieldWeight: vi.fn(),
  revert: vi.fn(),
  submit: vi.fn(),
  reload: vi.fn().mockResolvedValue(undefined),
  canSubmit: { value: true },
}));

vi.stubGlobal(
  "ResizeObserver",
  class implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

vi.mock("./hooks/useResearchScreen.js", () => ({
  useResearchScreen: (_sessionId: string) => ({
    state: hookMocks.stateFn(),
    loadError: null,
    setFieldWeight: hookMocks.setFieldWeight,
    revert: hookMocks.revert,
    submit: hookMocks.submit,
    reload: hookMocks.reload,
    canSubmit: hookMocks.canSubmit.value,
  }),
}));

afterEach(() => {
  cleanup();
  hookMocks.stateFn.mockReset();
  hookMocks.setFieldWeight.mockClear();
  hookMocks.revert.mockClear();
  hookMocks.submit.mockClear();
  hookMocks.canSubmit.value = true;
});

describe("ResearchScreen", () => {
  it("lists every research field and opens the best-funded field's chart", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    const map = screen.getByRole("navigation", { name: "Research fields" });
    expect(within(map).getAllByRole("button", { name: /discovered$/ })).toHaveLength(15);
    expect(screen.getByTestId("tech-node-hc_compound")).not.toBeNull();
    expect(screen.queryByTestId("tech-node-mac_compound")).toBeNull();
  });

  it("shows each technology's state on the chart", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    expect(screen.getByTestId("tech-node-hc_wrought").getAttribute("data-status")).toBe(
      "discovered",
    );
    expect(screen.getByTestId("tech-node-hc_compound").getAttribute("data-status")).toBe("open");
    expect(screen.getByTestId("tech-node-hc_nickel").getAttribute("data-status")).toBe("locked");
  });

  it("switches the chart when another field is chosen", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    fireEvent.click(screen.getByRole("button", { name: /^Machinery, Medium priority/ }));
    expect(screen.getByTestId("tech-node-mac_compound").getAttribute("data-status")).toBe(
      "researching",
    );
    expect(screen.queryByTestId("tech-node-hc_compound")).toBeNull();
  });

  it("sets a field priority through the weight control", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    const group = screen.getAllByRole("group", { name: /priority/i })[0]!;
    fireEvent.click(within(group).getByRole("button", { name: /Med$/ }));
    expect(hookMocks.setFieldWeight).toHaveBeenCalledWith("HULL_CONSTRUCTION", 2);
  });

  it("opens a technology's detail in a dialog when it is clicked", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    fireEvent.click(screen.getByTestId("tech-node-hc_compound"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("67% to be drawn next")).not.toBeNull();
    expect(within(dialog).getByText("Wrought Iron Hull")).not.toBeNull();
  });

  it("reports the budget and archive progress in the status bar", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    const bar = screen.getByRole("region", { name: "Engineering status" });
    expect(within(bar).getByText("60 pts/month")).not.toBeNull();
    expect(within(bar).getByText("1 / 7")).not.toBeNull();
  });

  it("applies and reverts through the command bar", () => {
    const edited = makeLoaded();
    if (edited.kind !== "loaded") throw new Error("expected loaded");
    hookMocks.stateFn.mockReturnValue({
      ...edited,
      draft: { ...edited.draft, GUNNERY: 4 },
    });
    render(<ResearchScreen sessionId="ses-1" />);

    expect(screen.getByText("Unsaved changes")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Revert/ }));
    expect(hookMocks.revert).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Set priorities/ }));
    expect(hookMocks.submit).toHaveBeenCalledTimes(1);
  });

  it("does not offer to apply an unchanged or invalid draft", () => {
    hookMocks.canSubmit.value = false;
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    expect(
      (screen.getByRole("button", { name: /Set priorities/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("warns when a High priority field has nothing open and its share goes elsewhere", () => {
    hookMocks.stateFn.mockReturnValue(
      makeLoaded({
        fieldPriorities: { HULL_CONSTRUCTION: 4, MACHINERY: 2, GUNNERY: 4 },
      }),
    );
    render(<ResearchScreen sessionId="ses-1" />);

    expect(
      screen.getAllByText(/High priority with nothing open to research/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("tells the truth about a field with no authored technologies", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded());
    render(<ResearchScreen sessionId="ses-1" />);

    fireEvent.click(screen.getByRole("button", { name: /^Missiles, Low priority/ }));
    expect(
      screen.getAllByText("No technologies are authored for this field yet.").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("says plainly that an empty budget spends nothing", () => {
    hookMocks.stateFn.mockReturnValue(makeLoaded({ researchBudget: 0 }));
    render(<ResearchScreen sessionId="ses-1" />);

    expect(screen.getByText("The research budget is empty, so nothing is spent.")).not.toBeNull();
  });

  it("explains a rejected submit instead of hiding it", () => {
    const loaded = makeLoaded();
    if (loaded.kind !== "loaded") throw new Error("expected loaded");
    hookMocks.stateFn.mockReturnValue({ ...loaded, notice: "REJECTED: stale revision" });
    render(<ResearchScreen sessionId="ses-1" />);

    expect(screen.getByText("Not applied")).not.toBeNull();
  });
});
