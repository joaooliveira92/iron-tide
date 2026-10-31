import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../components/design-workspace/content.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

vi.mock("../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 7,
  useCampaignMonthId: () => null,
  useActiveCampaignCurrencyContext: () => ({}),
  useLeaveGuard: () => () => undefined,
}));

const content = loadDrawingBoardContent();
const shipDraft = content.references[0]!.draft;
const project = {
  projectId: "con_x",
  className: "Test ship",
  status: "ACTIVE",
  totalWork: 20,
  completedWork: 4,
  revisable: true,
};
const execute = vi.fn();

beforeEach(() => {
  execute.mockReset();
  execute.mockImplementation(async (command: string) => {
    if (command === "loadProjectDraft")
      return {
        outcome: "success",
        value: { className: "Test ship", draft: shipDraft },
        diagnostics: [],
      };
    if (command === "reviseProjectCommand")
      return {
        outcome: "success",
        value: {
          commandId: "c",
          newDesignVersionId: "d2",
          tier: "T1_REVISION",
          appliedOnNextTurn: true,
        },
        diagnostics: [],
      };
    return { outcome: "error", reason: "UNEXPECTED", diagnostics: [] };
  });
  Reflect.set(window, "bluewave", { campaign: { execute } });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "bluewave");
});

const sections = () => screen.getByRole("navigation", { name: "Design sections" });
const openSection = (name: string) =>
  fireEvent.click(within(sections()).getByRole("button", { name: new RegExp(`^${name}`) }));
const bumpPower = () => {
  openSection("Machinery");
  const input = screen.getByLabelText(/^Installed power/) as HTMLInputElement;
  fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
  fireEvent.blur(input);
};
const openFinish = () => {
  openSection("Review");
  fireEvent.click(
    within(screen.getByRole("tablist", { name: /tabs$/ })).getByRole("tab", { name: "Finish" }),
  );
};
const preview = () => screen.getByRole("region", { name: "Revision preview" });

describe("Revising an ordered project from Ship design", () => {
  it("loads the ship's real draft and compares against it, with the engine's own diff", async () => {
    render(<ShipbuildingWorkspace sessionId="s1" projects={[project]} />);
    bumpPower();
    openFinish();
    await screen.findByRole("button", { name: /load this ship's design/i });
    expect(execute).toHaveBeenCalledWith("loadProjectDraft", {
      sessionId: "s1",
      projectId: "con_x",
    });
    await waitFor(() =>
      expect(within(preview()).getByRole("status").textContent).toMatch(/Redesign|Revision/),
    );
    expect(preview().textContent).toContain("machinery");
  });

  it("applies the revision through the bridge and reports the queued tier", async () => {
    render(<ShipbuildingWorkspace sessionId="s1" projects={[project]} />);
    bumpPower();
    openFinish();
    const apply = await screen.findByRole("button", { name: /apply revision/i });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/hull progress/);
    expect(execute.mock.calls.some((c) => c[0] === "reviseProjectCommand")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Queue the revision" }));
    await waitFor(() => expect(preview().textContent).toMatch(/Revision queued/));
    const call = execute.mock.calls.find((c) => c[0] === "reviseProjectCommand")!;
    expect(call[1]).toMatchObject({ sessionId: "s1", expectedRevision: 7, projectId: "con_x" });
  });

  it("shows the engine's refusal text instead of claiming success", async () => {
    execute.mockImplementation(async (command: string) =>
      command === "loadProjectDraft"
        ? {
            outcome: "success",
            value: { className: "Test ship", draft: shipDraft },
            diagnostics: [],
          }
        : {
            outcome: "rejected",
            reason: "REVISION_REQUIRES_REBUILD",
            diagnostics: ["needs a rebuild project"],
          },
    );
    render(<ShipbuildingWorkspace sessionId="s1" projects={[project]} />);
    bumpPower();
    openFinish();
    const apply = await screen.findByRole("button", { name: /apply revision/i });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    fireEvent.click(await screen.findByRole("button", { name: "Queue the revision" }));
    await waitFor(() => expect(preview().textContent).toContain("needs a rebuild project"));
  });

  it("an authored ship has no load or apply buttons and says it cannot be revised", () => {
    render(<ShipbuildingWorkspace sessionId="s1" projects={[{ ...project, revisable: false }]} />);
    openFinish();
    expect(screen.queryByRole("button", { name: /apply revision/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /load this ship/i })).toBeNull();
    expect(preview().textContent).toMatch(/cannot be revised/);
    expect(
      execute.mock.calls.some(
        (c) => c[0] === "loadProjectDraft" || c[0] === "reviseProjectCommand",
      ),
    ).toBe(false);
  });

  it("offers no revision panel when no project is being revised", () => {
    render(<ShipbuildingWorkspace sessionId="s1" />);
    openFinish();
    expect(screen.queryByRole("region", { name: "Revision preview" })).toBeNull();
  });
});
