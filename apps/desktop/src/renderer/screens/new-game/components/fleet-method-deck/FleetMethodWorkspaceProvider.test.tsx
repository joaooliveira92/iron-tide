/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { isBluewaveError } from "@bluewave/contracts";
import type { FleetMethodDraft } from "../../new-game-fleet-method-screen-state.js";
import { FleetMethodDeckPane } from "./FleetMethodDeckPane.js";
import { FleetMethodDetailPanel } from "./FleetMethodDetailPanel.js";
import {
  FleetMethodWorkspaceProvider,
  useFleetMethodActions,
  useFleetMethodMeta,
  useFleetMethodState,
} from "./FleetMethodWorkspaceProvider.js";
import {
  useFleetMethodWorkspace,
  type FleetMethodWorkspace,
  type FleetMethodWorkspaceActions,
} from "./useFleetMethodWorkspace.js";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
});

function Probe({ onRead }: { onRead: (workspace: FleetMethodWorkspace) => void }) {
  const state = useFleetMethodState();
  const actions = useFleetMethodActions();
  const meta = useFleetMethodMeta();
  onRead({ state, actions, meta });
  return null;
}

function Harness({
  initialFleetMethod,
  launching,
  onNext,
  latest,
}: {
  readonly initialFleetMethod: FleetMethodDraft;
  readonly launching: boolean;
  readonly onNext: (fleetMethod: FleetMethodDraft) => void;
  readonly latest: { current: FleetMethodWorkspace | null };
}) {
  const workspace = useFleetMethodWorkspace({ initialFleetMethod, launching, onNext });
  return (
    <FleetMethodWorkspaceProvider workspace={workspace}>
      <FleetMethodDeckPane />
      <section aria-label="Fleet method details">
        <FleetMethodDetailPanel key={workspace.meta.detail.card?.id ?? "none"} />
      </section>
      <Probe onRead={(value) => void (latest.current = value)} />
    </FleetMethodWorkspaceProvider>
  );
}

function setup(
  initialFleetMethod: FleetMethodDraft = { legacyFleetModeId: "generated" },
  launching = false,
) {
  const latest: { current: FleetMethodWorkspace | null } = { current: null };
  const onNext = vi.fn();
  render(
    <Harness
      initialFleetMethod={initialFleetMethod}
      launching={launching}
      onNext={onNext}
      latest={latest}
    />,
  );
  return {
    onNext,
    read: () => {
      const current = latest.current;
      if (current === null) throw new Error("the probe has not read the workspace");
      return current;
    },
    run: (action: (actions: FleetMethodWorkspaceActions) => void) => {
      const current = latest.current;
      if (current === null) throw new Error("the probe has not read the workspace");
      act(() => {
        action(current.actions);
      });
    },
  };
}

function deckOption(name: string): HTMLElement {
  return within(screen.getByRole("listbox", { name: "Starting-fleet methods" })).getByRole(
    "option",
    { name },
  );
}

function detailRegion(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function detailHeading(): string {
  const heading = screen.getByRole("region", { name: "Fleet method details" }).querySelector("h2");
  return heading?.textContent as string;
}

describe("FleetMethodWorkspaceProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("feeds the deck selection and the detail heading from one workspace", () => {
    const { read, run } = setup();

    expect(detailHeading()).toBe("Inherit an Existing Navy");
    expect(read().state.focusedIndex).toBe(0);

    run((actions) => actions.focusIndex(2));

    expect(detailHeading()).toBe("Curated Historical-Inspired Fleet");
    expect(read().state.focusedIndex).toBe(2);
    expect(read().meta.deck.focusedIndex).toBe(2);
  });

  it("moves the detail panel when the deck part takes keyboard input", () => {
    const { read } = setup();

    fireEvent.keyDown(screen.getByRole("listbox", { name: "Starting-fleet methods" }), {
      key: "ArrowRight",
    });

    expect(detailHeading()).toBe("Build the Legacy Fleet Manually");
    expect(read().state.focusedIndex).toBe(1);
    expect(read().meta.detail.card?.id).toBe("disabled");
  });

  it("applies the activated card through actions into state and meta", () => {
    const { read, run } = setup();

    run((actions) => actions.focusIndex(2));
    expect(read().meta.detail.applied).toBe(false);

    run((actions) => actions.activateIndex(2));

    expect(read().state.pendingId).toBeNull();
    expect(read().meta.detail.applied).toBe(true);
    expect(read().meta.deck.activeId).toBe("historical");
    expect(read().state.fleetMethod.legacyFleetModeId).toBe("historical");
    expect(deckOption("Curated Historical-Inspired Fleet").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(
      within(detailRegion("Curated Historical-Inspired Fleet")).getByText("Active"),
    ).toBeTruthy();
  });

  it("marks a focused card pending and swaps the primary action label", () => {
    const { read, run } = setup();

    run((actions) => actions.focusIndex(1));

    expect(read().meta.detail.pending).toBe(true);
    expect(read().meta.primaryAction.label).toBe("Select");
    expect(
      within(detailRegion("Build the Legacy Fleet Manually")).getByText("Applies on Next"),
    ).toBeTruthy();
  });

  it("selects the pending card instead of advancing while one is unapplied", () => {
    const { onNext, read, run } = setup();

    run((actions) => actions.focusIndex(2));
    run((actions) => actions.commit());

    expect(onNext).not.toHaveBeenCalled();
    expect(read().meta.activeName).toBe("Curated Historical-Inspired Fleet");
  });

  it("hands the applied draft to onNext once nothing is pending", () => {
    const { onNext, run } = setup();

    run((actions) => actions.activateIndex(1));
    run((actions) => actions.commit());

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext.mock.calls[0]?.[0]).toEqual({ legacyFleetModeId: "disabled" });
  });

  it("disables the primary action and blocks the commit while launching", () => {
    const { onNext, read, run } = setup({ legacyFleetModeId: "historical" }, true);

    expect(read().meta.primaryAction.label).toBe("Starting…");
    expect(read().meta.primaryAction.disabled).toBe(true);

    run((actions) => actions.commit());

    expect(onNext).not.toHaveBeenCalled();
  });

  it("shows the card description and note in the detail panel body", () => {
    setup({ legacyFleetModeId: "disabled" });
    const region = detailRegion("Build the Legacy Fleet Manually");
    expect(within(region).getByText(/left entirely to you/u)).toBeTruthy();
    expect(within(region).getByText(/future work/u)).toBeTruthy();
  });

  it("refuses to read the workspace outside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let caught: unknown = null;
    try {
      render(<Probe onRead={() => undefined} />);
    } catch (error) {
      caught = error;
    }
    consoleError.mockRestore();

    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as { message: string }).message).toBe("FLEET_METHOD_WORKSPACE_PROVIDER_MISSING");
  });
});
