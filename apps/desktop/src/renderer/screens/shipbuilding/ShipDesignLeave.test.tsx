import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { LeaveGuard, LeaveTarget } from "../../shell/campaign-screen-types.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

const shell = vi.hoisted(() => ({
  guard: null as null | ((target: LeaveTarget) => boolean),
  proceed: vi.fn(),
}));

vi.mock("../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 0,
  useCampaignMonthId: () => "1880-01",
  useActiveCampaignCurrencyContext: () => ({}),
  useLeaveGuard: (guard: LeaveGuard) => {
    shell.guard = guard;
    return (target: LeaveTarget) => shell.proceed(target);
  },
}));

const execute = vi.fn();
let failWrites = false;

beforeEach(() => {
  failWrites = false;
  shell.guard = null;
  shell.proceed.mockReset();
  execute.mockReset();
  execute.mockImplementation(async (command: string) => {
    if (command === "readDrawingBoardDraft")
      return { outcome: "success", value: { draft: null }, diagnostics: [] };
    if (command === "writeDrawingBoardDraft")
      return failWrites
        ? { outcome: "error", reason: "DISK_FULL", diagnostics: [] }
        : { outcome: "success", value: { saved: true }, diagnostics: [] };
    return { outcome: "error", reason: "UNEXPECTED", diagnostics: [] };
  });
  Reflect.set(window, "bluewave", { campaign: { execute } });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "bluewave");
});

const leaving = (target: LeaveTarget) => {
  let allowed = true;
  act(() => {
    allowed = shell.guard!(target);
  });
  return allowed;
};

async function editPower() {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Design sections" })).getByRole("button", {
      name: /^Machinery/,
    }),
  );
  await waitFor(() => expect(execute).toHaveBeenCalledWith("readDrawingBoardDraft", "s1"));
  const input = screen.getByLabelText(/^Installed power/) as HTMLInputElement;
  fireEvent.change(input, { target: { value: String(Number(input.value) + 100) } });
  fireEvent.blur(input);
}

describe("leaving Ship design", () => {
  it("lets the player go without asking while every edit has been saved", async () => {
    render(<ShipbuildingWorkspace sessionId="s1" />);
    await editPower();
    await waitFor(
      () => expect(execute.mock.calls.some((c) => c[0] === "writeDrawingBoardDraft")).toBe(true),
      { timeout: 3000 },
    );
    expect(leaving("fleet")).toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks first when the latest edits could not be saved, and keeps the player here on Keep designing", async () => {
    failWrites = true;
    render(<ShipbuildingWorkspace sessionId="s1" />);
    await editPower();
    await screen.findByText(/The draft is not saved/, undefined, { timeout: 3000 });
    expect(leaving("fleet")).toBe(false);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/Leave with unsaved changes\?/);
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancel|Keep/ }));
    expect(shell.proceed).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("goes where the player was headed, by back, forward or screen, after Leave anyway", async () => {
    failWrites = true;
    render(<ShipbuildingWorkspace sessionId="s1" />);
    await editPower();
    await screen.findByText(/The draft is not saved/, undefined, { timeout: 3000 });
    expect(leaving("back")).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Leave anyway" }));
    expect(shell.proceed).toHaveBeenCalledWith("back");
  });

  it("never blocks a move to the screen it is already on", async () => {
    failWrites = true;
    render(<ShipbuildingWorkspace sessionId="s1" />);
    await editPower();
    await screen.findByText(/The draft is not saved/, undefined, { timeout: 3000 });
    expect(leaving("ship-design")).toBe(true);
  });
});
