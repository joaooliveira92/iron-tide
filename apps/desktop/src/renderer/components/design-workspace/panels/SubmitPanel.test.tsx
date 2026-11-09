import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../content.js";
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

  const reviewed = (freeTreasury: number, affordable: boolean) => ({
    outcome: "success",
    value: {
      study: {
        months: 4,
        cost: 8,
        derived: false,
        discountBp: 0,
        baselineClassName: null,
        newFamily: true,
        failedCriteria: [],
      },
      treasuryUnits: freeTreasury + 3,
      freeTreasury,
      affordable,
    },
    diagnostics: [],
  });

  it("reviews months, cost, payments and the treasury before and after, when affordable", async () => {
    execute.mockResolvedValue(reviewed(100, true));
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" name="Arethusa" onNameChange={() => {}} />
      </DesignWorkspaceFixture>,
    );
    const review = await screen.findByTestId("submit-review");
    const text = review.textContent ?? "";
    expect(text).toContain("Arethusa");
    expect(text).toContain("4 months");
    expect(text).toContain("8 treasury units");
    expect(text).toContain("2 treasury units a month for 4 months");
    expect(text).toContain("100");
    expect(text).toContain("92");
    expect(screen.getByTestId("affordability").textContent).toBe(
      "The treasury covers the whole study.",
    );
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("warns, without blocking, when only the first payment fits", async () => {
    execute.mockResolvedValue(reviewed(5, true));
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" name="Arethusa" onNameChange={() => {}} />
      </DesignWorkspaceFixture>,
    );
    const message = (await screen.findByTestId("affordability")).textContent ?? "";
    expect(message).toContain("first payment of 2");
    expect(message).toContain("not the whole study (8)");
    expect(message).toContain("A month without the money makes no progress");
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("warns, without blocking, when the treasury cannot pay this month", async () => {
    execute.mockResolvedValue(reviewed(1, false));
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" name="Arethusa" onNameChange={() => {}} />
      </DesignWorkspaceFixture>,
    );
    const message = (await screen.findByTestId("affordability")).textContent ?? "";
    expect(message).toContain("cannot pay the first monthly payment of 2");
    expect(message).toContain("You can still submit");
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("names a variant discount in the review", async () => {
    const base = reviewed(100, true);
    execute.mockResolvedValue({
      ...base,
      value: {
        ...base.value,
        study: {
          ...base.value.study,
          derived: true,
          discountBp: 2500,
          baselineClassName: "Orlando",
        },
      },
    });
    render(
      <DesignWorkspaceFixture>
        <SubmitPanel sessionId="s" name="Arethusa" onNameChange={() => {}} />
      </DesignWorkspaceFixture>,
    );
    expect((await screen.findByTestId("submit-review")).textContent).toMatch(
      /variant of Orlando.*25%/,
    );
  });

  it("lists the blocking findings as links, gives a plain reason and disables Submit", () => {
    const onSelect = vi.fn();
    const content = loadDrawingBoardContent();
    const reference = content.references[0]!;
    const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
    render(
      <DesignWorkspaceFixture view={{ ...view, valid: false }}>
        <SubmitPanel
          sessionId="s"
          name="Arethusa"
          onNameChange={() => {}}
          blockers={[
            { id: "b1", text: "Hull too heavy", actionLabel: "Fix in Hull", onSelect },
            { id: "b2", text: "No machinery", actionLabel: "Review finding", onSelect: vi.fn() },
          ]}
        />
      </DesignWorkspaceFixture>,
    );
    expect(screen.getByText(/Submit is unavailable: 2 blocking findings/)).toBeTruthy();
    expect(screen.getByText("Hull too heavy")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fix in Hull" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(
      (screen.getByRole("button", { name: "Submit design" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByTestId("submit-review")).toBeNull();
    expect(execute).not.toHaveBeenCalled();
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
