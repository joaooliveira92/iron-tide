import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";
import { loadDrawingBoardContent } from "../../components/design-workspace/content.js";

vi.mock("../../shell/CampaignShellContext.js", () => ({
  useCampaignReads: () => null,
  useCampaignRevision: () => 7,
  useCampaignMonthId: () => null,
  useActiveCampaignCurrencyContext: () => ({}),
  useLeaveGuard: () => () => undefined,
}));

const content = loadDrawingBoardContent();
const otherDraft = content.references[1]!.draft;
const project = {
  projectId: "con_open",
  className: "Nelson Pilot",
  status: "ACTIVE",
  totalWork: 20,
  completedWork: 4,
  revisable: true,
};
const execute = vi.fn();

beforeEach(() => {
  execute.mockReset();
  execute.mockImplementation(async (command: string) =>
    command === "loadProjectDraft"
      ? {
          outcome: "success",
          value: { className: "Nelson Pilot", draft: otherDraft },
          diagnostics: [],
        }
      : { outcome: "error", reason: "UNEXPECTED", diagnostics: [] },
  );
  Reflect.set(window, "bluewave", { campaign: { execute } });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "bluewave");
});

const openDesignDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: /More design actions/ }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Open design…" }));
};
const header = () => screen.getByRole("group", { name: "Design commands" });
const bumpPower = () => {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Design sections" })).getByRole("button", {
      name: /^Machinery/,
    }),
  );
  const input = screen.getByLabelText(/^Installed power/) as HTMLInputElement;
  fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
  fireEvent.blur(input);
};

describe("Opening a design from the header", () => {
  it("opens an in-progress ship as the baseline, names it in the header, and starts with clean history", async () => {
    render(<ShipbuildingWorkspace sessionId="s1" projects={[project]} />);
    openDesignDialog();
    const dialog = screen.getByRole("dialog", { name: "Open a design" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Nelson Pilot/ }));
    await waitFor(() => expect(header().textContent).toContain("Developed from Nelson Pilot"));
    expect(execute).toHaveBeenCalledWith("loadProjectDraft", {
      sessionId: "s1",
      projectId: "con_open",
    });
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks before replacing a design with unsaved edits, and keeps it on cancel", async () => {
    render(<ShipbuildingWorkspace sessionId="s1" projects={[project]} />);
    bumpPower();
    const before = header().textContent;
    openDesignDialog();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Open a design" })).getByRole("button", {
        name: /Nelson Pilot/,
      }),
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toMatch(/Replace my design/);
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep what I have" }));
    expect(execute.mock.calls.some((c) => c[0] === "loadProjectDraft")).toBe(false);
    expect(screen.getByRole("group", { name: "Design commands", hidden: true }).textContent).toBe(
      before,
    );
  });
});
