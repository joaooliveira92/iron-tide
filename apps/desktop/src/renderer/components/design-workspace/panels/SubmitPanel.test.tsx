import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../content.js";
import { rejectionLead, SubmitPanel } from "./SubmitPanel.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 3,
  useActiveCampaignCurrencyContext: () => ({}),
}));

const draft = loadDrawingBoardContent().references[0]!.draft;
const execute = vi.fn();
beforeEach(() => {
  execute.mockReset();
  (window as unknown as { bluewave: unknown }).bluewave = { campaign: { execute } };
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { bluewave?: unknown }).bluewave;
});

const name = (v: string) =>
  fireEvent.change(screen.getByLabelText("Class name"), { target: { value: v } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /Submit design|Queued/ }));

describe("SubmitPanel", () => {
  it("queues the design once: the same design and name cannot be sent twice", async () => {
    execute.mockResolvedValue({
      outcome: "success",
      value: { commandId: "c", designVersionId: "d", appliedOnNextTurn: true },
      diagnostics: [],
    });
    render(<SubmitPanel sessionId="s" draft={draft} valid />);
    name("Arethusa");
    submit();
    expect(await screen.findByText(/Design queued/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Queued" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![1]).toMatchObject({
      sessionId: "s",
      expectedRevision: 3,
      className: "Arethusa",
    });
    name("Arethusa II");
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("says why Submit is unavailable until the class has a name", () => {
    render(<SubmitPanel sessionId="s" draft={draft} valid />);
    expect(screen.getByText("Name the class to submit it.")).toBeTruthy();
    name("Arethusa");
    expect(screen.queryByText("Name the class to submit it.")).toBeNull();
  });

  it("shows the host's class name as text and sends the player to the one field to edit it", () => {
    const onRequestName = vi.fn();
    const { rerender } = render(
      <SubmitPanel
        sessionId="s"
        draft={draft}
        valid
        name=""
        onNameChange={() => {}}
        onRequestName={onRequestName}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Not named yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter a class name" }));
    expect(onRequestName).toHaveBeenCalledOnce();
    rerender(
      <SubmitPanel
        sessionId="s"
        draft={draft}
        valid
        name="Arethusa"
        onNameChange={() => {}}
        onRequestName={onRequestName}
      />,
    );
    expect(screen.getByText("Arethusa")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enter a class name" })).toBeNull();
  });

  it("explains a refusal in plain words and keeps the design", async () => {
    execute.mockResolvedValue({
      outcome: "rejected",
      reason: "DESIGN_REJECTED",
      diagnostics: ["Displacement exceeds the limit."],
    });
    render(<SubmitPanel sessionId="s" draft={draft} valid />);
    name("Heavy");
    submit();
    expect(await screen.findByText(/cannot be built/)).toBeTruthy();
    expect(screen.getByText("Displacement exceeds the limit.")).toBeTruthy();
    expect(screen.getByText(/Your design is unchanged/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("reports a bridge failure instead of an unhandled rejection", async () => {
    execute.mockRejectedValue(new Error("channel closed"));
    render(<SubmitPanel sessionId="s" draft={draft} valid />);
    name("Lost");
    submit();
    await waitFor(() =>
      expect(screen.getByText(/could not be reached \(channel closed\)/)).toBeTruthy(),
    );
  });

  it("words every reason without exposing raw codes", () => {
    expect(rejectionLead("SESSION_NOT_FOUND")).toMatch(/no longer open/);
    expect(rejectionLead("STALE_EXPECTED_REVISION")).toBe(
      "The design was not queued (stale expected revision):",
    );
  });
});
