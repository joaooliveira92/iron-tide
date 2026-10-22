import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DrawingBoard } from "./DrawingBoard.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { openTab, region } from "./test-helpers.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 7,
  useCampaignMonthId: () => null,
  useActiveCampaignCurrencyContext: () => ({}),
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
  (window as unknown as { bluewave: unknown }).bluewave = { campaign: { execute } };
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { bluewave?: unknown }).bluewave;
});

describe("Revision preview for a revisable project", () => {
  it("loads the ship's real draft and compares against it, with the engine's own diff", async () => {
    render(<DrawingBoard sessionId="s1" projects={[project]} />);
    openTab("Build");
    await screen.findByRole("button", { name: /load this ship's design/i });
    expect(execute).toHaveBeenCalledWith("loadProjectDraft", {
      sessionId: "s1",
      projectId: "con_x",
    });
    expect(within(region("Revision preview")).getByText(/No changes yet/)).toBeTruthy();
    const input = screen.getByLabelText(/installed power/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(within(region("Revision preview")).getByRole("status").textContent).toMatch(
        /Redesign|Revision/,
      ),
    );
    expect(region("Revision preview").textContent).toContain("machinery");
  });

  it("applies the revision through the bridge and reports the queued tier", async () => {
    render(<DrawingBoard sessionId="s1" projects={[project]} />);
    openTab("Build");
    await screen.findByRole("button", { name: /load this ship's design/i });
    const input = screen.getByLabelText(/installed power/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
    fireEvent.blur(input);
    const apply = await screen.findByRole("button", { name: /apply revision/i });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/hull progress/);
    expect(execute.mock.calls.some((c) => c[0] === "reviseProjectCommand")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Queue the revision" }));
    await waitFor(() => expect(region("Revision preview").textContent).toMatch(/Revision queued/));
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
    render(<DrawingBoard sessionId="s1" projects={[project]} />);
    openTab("Build");
    await screen.findByRole("button", { name: /load this ship's design/i });
    const input = screen.getByLabelText(/installed power/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
    fireEvent.blur(input);
    const apply = await screen.findByRole("button", { name: /apply revision/i });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    fireEvent.click(await screen.findByRole("button", { name: "Queue the revision" }));
    await waitFor(() =>
      expect(region("Revision preview").textContent).toContain("needs a rebuild project"),
    );
  });

  it("an authored ship has no load or apply buttons and says it cannot be revised", () => {
    render(<DrawingBoard sessionId="s1" projects={[{ ...project, revisable: false }]} />);
    expect(screen.queryByRole("button", { name: /apply revision/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /load this ship/i })).toBeNull();
    expect(region("Revision preview").textContent).toMatch(/cannot be revised/);
    expect(
      execute.mock.calls.some(
        (c) => c[0] === "loadProjectDraft" || c[0] === "reviseProjectCommand",
      ),
    ).toBe(false);
  });
});
