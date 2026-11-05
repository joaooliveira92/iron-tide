import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DesignWorkspaceFixture } from "../DesignWorkspaceFixture.js";
import { rejectionLead, SubmitPanel } from "./SubmitPanel.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 3,
  useCampaignReads: () => null,
  useActiveCampaignCurrencyContext: () => ({}),
}));

const execute = vi.fn();
beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue({ outcome: "success", value: {}, diagnostics: [] });
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
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" />
      </DesignWorkspaceFixture>,
    );
    name("Arethusa");
    submit();
    expect(await screen.findByText(/Design queued/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Queued" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const submits = execute.mock.calls.filter((c) => c[0] === "submitDesignCommand");
    expect(submits).toHaveLength(1);
    expect(submits[0]![1]).toMatchObject({
      sessionId: "s",
      expectedRevision: 3,
      className: "Arethusa",
    });
    name("Arethusa II");
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("shows the design study before Submit and ignores a slower earlier answer", async () => {
    const study = (months: number, cost: number) => ({
      months,
      cost,
      derived: false,
      discountBp: 0,
      baselineClassName: null,
      newFamily: true,
      failedCriteria: [],
    });
    const pending: Array<(value: unknown) => void> = [];
    execute.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" />
      </DesignWorkspaceFixture>,
    );
    name("First");
    name("Second");
    await waitFor(() => expect(pending).toHaveLength(2));
    pending[1]!({ outcome: "success", value: { study: study(7, 9) }, diagnostics: [] });
    expect(await screen.findByText(/7 months and 9 treasury units/)).toBeTruthy();
    pending[0]!({ outcome: "success", value: { study: study(2, 3) }, diagnostics: [] });
    await Promise.resolve();
    expect(screen.queryByText(/2 months/)).toBeNull();
    expect(screen.getByText(/7 months and 9 treasury units/)).toBeTruthy();
    expect(execute.mock.calls.map((c) => c[0])).toEqual([
      "previewDesignStudy",
      "previewDesignStudy",
    ]);
  });

  it("says why Submit is unavailable until the class has a name", () => {
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" />
      </DesignWorkspaceFixture>,
    );
    expect(screen.getByText("Name the class to submit it.")).toBeTruthy();
    name("Arethusa");
    expect(screen.queryByText("Name the class to submit it.")).toBeNull();
  });

  it("shows the host's class name as text and sends the player to the one field to edit it", () => {
    const onRequestName = vi.fn();
    const panel = (name: string) => (
      <DesignWorkspaceFixture>
        <SubmitPanel
          sessionId="s"
          name={name}
          onNameChange={() => {}}
          onRequestName={onRequestName}
        />
      </DesignWorkspaceFixture>
    );
    const { rerender } = render(panel(""));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Not named yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter a class name" }));
    expect(onRequestName).toHaveBeenCalledOnce();
    rerender(panel("Arethusa"));
    expect(screen.getByText("Arethusa")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enter a class name" })).toBeNull();
  });

  it("explains a refusal in plain words and keeps the design", async () => {
    execute.mockResolvedValue({
      outcome: "rejected",
      reason: "DESIGN_REJECTED",
      diagnostics: ["Displacement exceeds the limit."],
    });
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" />
      </DesignWorkspaceFixture>,
    );
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
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" />
      </DesignWorkspaceFixture>,
    );
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
