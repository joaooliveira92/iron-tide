/* @vitest-environment jsdom */
import { ARCHETYPE_DIMENSION_MAX, type ArchetypeSelection } from "@bluewave/campaign-engine";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { isBluewaveError } from "@bluewave/contracts";
import { ArchetypeDeckPane } from "./ArchetypeDeckPane.js";
import { ArchetypeDetailPanel } from "./ArchetypeDetailPanel.js";
import {
  ArchetypeWorkspaceProvider,
  useArchetypeActions,
  useArchetypeMeta,
  useArchetypeState,
} from "./ArchetypeWorkspaceProvider.js";
import {
  useArchetypeWorkspace,
  type ArchetypeWorkspace,
  type ArchetypeWorkspaceActions,
} from "./useArchetypeWorkspace.js";

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

function Probe({ onRead }: { onRead: (workspace: ArchetypeWorkspace) => void }) {
  const state = useArchetypeState();
  const actions = useArchetypeActions();
  const meta = useArchetypeMeta();
  onRead({ state, actions, meta });
  return null;
}

function Harness({
  initialArchetype,
  onNext,
  latest,
}: {
  readonly initialArchetype: ArchetypeSelection | null;
  readonly onNext: (selection: ArchetypeSelection) => void;
  readonly latest: { current: ArchetypeWorkspace | null };
}) {
  const workspace = useArchetypeWorkspace({ initialArchetype, onNext });
  return (
    <ArchetypeWorkspaceProvider workspace={workspace}>
      <ArchetypeDeckPane />
      <section aria-label="Archetype details">
        <ArchetypeDetailPanel key={workspace.meta.detail.slotId ?? "none"} />
      </section>
      <Probe onRead={(value) => void (latest.current = value)} />
    </ArchetypeWorkspaceProvider>
  );
}

function setup(initialArchetype: ArchetypeSelection | null = null) {
  const latest: { current: ArchetypeWorkspace | null } = { current: null };
  const onNext = vi.fn();
  render(<Harness initialArchetype={initialArchetype} onNext={onNext} latest={latest} />);
  return {
    onNext,
    read: () => {
      const current = latest.current;
      if (current === null) throw new Error("the probe has not read the workspace");
      return current;
    },
    run: (action: (actions: ArchetypeWorkspaceActions) => void) => {
      const current = latest.current;
      if (current === null) throw new Error("the probe has not read the workspace");
      act(() => {
        action(current.actions);
      });
    },
  };
}

function deckOption(name: string): HTMLElement {
  return within(screen.getByRole("listbox", { name: "Archetype presets" })).getByRole("option", {
    name,
  });
}

function detailRegion(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function detailHeading(): string {
  const heading = screen.getByRole("region", { name: "Archetype details" }).querySelector("h2");
  return heading?.textContent as string;
}

describe("ArchetypeWorkspaceProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("feeds the deck selection and the detail heading from one workspace", () => {
    const { read, run } = setup();

    expect(detailHeading()).toBe("Merchant Prince");
    expect(read().state.focusedIndex).toBe(0);

    run((actions) => actions.focusIndex(1));

    expect(detailHeading()).toBe("Shipyard Baron");
    expect(read().state.focusedIndex).toBe(1);
    expect(read().meta.deck.focusedIndex).toBe(1);
  });

  it("moves the detail panel when the deck part takes keyboard input", () => {
    const { read } = setup();

    fireEvent.keyDown(screen.getByRole("listbox", { name: "Archetype presets" }), {
      key: "ArrowLeft",
    });

    expect(detailHeading()).toBe("Create Your Own");
    expect(read().state.focusedIndex).toBe(3);
    expect(read().meta.detail.entry.kind).toBe("custom");
    expect(read().state.allocatorFocusRequest).toBe(0);
  });

  it("applies the activated preset through actions into state and meta", () => {
    const { read, run } = setup();

    run((actions) => actions.focusIndex(1));
    expect(read().meta.detail.applied).toBe(false);

    run((actions) => actions.activateIndex(1));

    expect(read().state.pendingSlotId).toBeNull();
    expect(read().meta.detail.applied).toBe(true);
    expect(read().meta.deck.appliedPresetId).toBe("shipyard_baron");
    expect(deckOption("Shipyard Baron").getAttribute("aria-selected")).toBe("true");
    expect(within(detailRegion("Shipyard Baron")).getByText("Active")).toBeTruthy();
  });

  it("marks a focused preset pending and swaps the primary action label", () => {
    const { read, run } = setup();

    run((actions) => actions.focusIndex(2));

    expect(read().meta.detail.pending).toBe(true);
    expect(read().meta.primaryAction.label).toBe("Select");
    expect(within(detailRegion("Grand Admiral")).getByText("Applies on Next")).toBeTruthy();
  });

  it("keeps the custom editor points and errors in meta and moves them with actions", () => {
    const { read, run } = setup();

    run((actions) => actions.activateIndex(3));
    expect(read().meta.detail.entry.kind).toBe("custom");
    expect(read().meta.detail.points).toBe(20);

    run((actions) => actions.changeDimension("economy", ARCHETYPE_DIMENSION_MAX + 2));

    const allocation = read().state.draft.allocation;
    expect(allocation.economy).toBe(ARCHETYPE_DIMENSION_MAX);
    expect(read().meta.detail.points).toBe(
      ARCHETYPE_DIMENSION_MAX + allocation.industry + allocation.combat,
    );
    expect(read().meta.detail.errors.length).toBeGreaterThan(0);
    expect(within(detailRegion("Create Your Own")).getByText("Budget used")).toBeTruthy();
  });

  it("hands the applied selection to onNext once nothing is pending", () => {
    const { onNext, run } = setup();

    run((actions) => actions.activateIndex(0));
    run((actions) => actions.commit());

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext.mock.calls[0]?.[0]).toMatchObject({ kind: "preset", id: "merchant_prince" });
  });

  it("selects the pending card instead of advancing while one is unapplied", () => {
    const { onNext, read, run } = setup();

    run((actions) => actions.focusIndex(1));
    run((actions) => actions.commit());

    expect(onNext).not.toHaveBeenCalled();
    expect(read().meta.appliedName).toBe("Shipyard Baron");
  });

  it("shows the preset description in the detail panel body", () => {
    setup();
    expect(within(detailRegion("Merchant Prince")).getByText(/Leans on trade/u)).toBeTruthy();
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
    expect((caught as { message: string }).message).toBe("ARCHETYPE_WORKSPACE_PROVIDER_MISSING");
  });
});
