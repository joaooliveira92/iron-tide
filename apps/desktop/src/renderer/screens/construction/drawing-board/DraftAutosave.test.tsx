import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { decodeLog, encodeLog, newLog, pushEdit } from "@bluewave/ship-design";
import { Toaster } from "../../../components/ui/toast.js";
import { DrawingBoard } from "./DrawingBoard.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 0,
  useCampaignMonthId: () => "1880-01",
  useActiveCampaignCurrencyContext: () => ({}),
}));

const renderBoard = (props: Parameters<typeof DrawingBoard>[0] = {}): ReturnType<typeof render> =>
  render(
    <>
      <Toaster />
      <DrawingBoard {...props} />
    </>,
  );

const content = loadDrawingBoardContent();
const start = content.references.find((r) => r.month <= "1880-01")!;
const savedLog = pushEdit(newLog(start.draft), {
  kind: "set_machinery",
  patch: { installedKw: start.draft.machinery.installedKw + 100 },
});

const execute = vi.fn();
let stored: { presetId: string; log: string; savedAt: string } | null = null;
let releaseRead: () => void = () => {};
let holdRead = false;

beforeEach(() => {
  stored = null;
  holdRead = false;
  execute.mockReset();
  execute.mockImplementation(async (command: string, payload: unknown) => {
    if (command === "readDrawingBoardDraft") {
      if (holdRead) await new Promise<void>((r) => (releaseRead = r));
      return { outcome: "success", value: { draft: stored }, diagnostics: [] };
    }
    if (command === "writeDrawingBoardDraft") {
      const d = (payload as { draft: { presetId: string; log: string } | null }).draft;
      stored = d === null ? null : { ...d, savedAt: "2026-10-09T10:00:00.000Z" };
      return { outcome: "success", value: { saved: d !== null }, diagnostics: [] };
    }
    return { outcome: "error", reason: "UNEXPECTED", diagnostics: [] };
  });
  (window as unknown as { bluewave: unknown }).bluewave = { campaign: { execute } };
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { bluewave?: unknown }).bluewave;
});

const writes = () => execute.mock.calls.filter((c) => c[0] === "writeDrawingBoardDraft");
const editPower = (kw: number) => {
  const input = screen.getByLabelText(/installed power/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value: String(kw) } });
  fireEvent.blur(input);
};

describe("Drawing Board autosave", () => {
  it("restores the saved design with its history, and says so", async () => {
    stored = { presetId: start.id, log: encodeLog(savedLog), savedAt: "2026-10-09T09:00:00.000Z" };
    renderBoard({ sessionId: "s1" });
    expect(await screen.findByText(/unsubmitted design was restored/)).toBeTruthy();
    expect(screen.getByText("1 edit")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(false);
  });

  it("saves shortly after an edit, and flushes a waiting save when the board closes", async () => {
    const { unmount } = renderBoard({ sessionId: "s1" });
    await waitFor(() => expect(execute).toHaveBeenCalledWith("readDrawingBoardDraft", "s1"));
    editPower(start.draft.machinery.installedKw + 250);
    await waitFor(() => expect(stored).not.toBeNull(), { timeout: 3000 });
    expect(decodeLog(stored!.log).edits).toHaveLength(1);
    editPower(start.draft.machinery.installedKw + 500);
    unmount();
    expect(decodeLog(stored!.log).edits).toHaveLength(2);
  });

  it("never writes before the saved design has been read", async () => {
    holdRead = true;
    stored = { presetId: start.id, log: encodeLog(savedLog), savedAt: "2026-10-09T09:00:00.000Z" };
    renderBoard({ sessionId: "s1" });
    await new Promise((r) => setTimeout(r, 600));
    expect(writes()).toHaveLength(0);
    await act(async () => releaseRead());
    expect(await screen.findByText(/unsubmitted design was restored/)).toBeTruthy();
    expect(decodeLog(stored!.log).edits).toHaveLength(1);
  });

  it("start over drops the saved design and removes the file", async () => {
    stored = { presetId: start.id, log: encodeLog(savedLog), savedAt: "2026-10-09T09:00:00.000Z" };
    renderBoard({ sessionId: "s1" });
    fireEvent.click(await screen.findByRole("button", { name: "Start over" }));
    expect(screen.getByText("No edits")).toBeTruthy();
    await waitFor(() => expect(stored).toBeNull(), { timeout: 3000 });
    expect(screen.queryByText(/unsubmitted design was restored/)).toBeNull();
  });

  it("keeps the fresh start when the saved log no longer applies to this content", async () => {
    stored = { presetId: "a_design_that_was_removed", log: encodeLog(savedLog), savedAt: "x" };
    renderBoard({ sessionId: "s1" });
    await waitFor(() => expect(execute).toHaveBeenCalledWith("readDrawingBoardDraft", "s1"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/unsubmitted design was restored/)).toBeNull();
    expect(screen.getByText("No edits")).toBeTruthy();
  });
});
